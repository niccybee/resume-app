begin;

create table if not exists public.cv_mcp_gateway_config (
  singleton boolean primary key default true check (singleton),
  gateway_key_sha256 text not null check (gateway_key_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

alter table public.cv_mcp_gateway_config enable row level security;
revoke all on public.cv_mcp_gateway_config from public, anon, authenticated;
grant select, insert, update, delete on public.cv_mcp_gateway_config to service_role;

create or replace function public.check_resume_studio_request()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id text := nullif((select auth.jwt() ->> 'client_id'), '');
  v_headers jsonb := coalesce(
    nullif(current_setting('request.headers', true), ''),
    '{}'
  )::jsonb;
  v_gateway_key text;
begin
  if v_client_id is null then
    return;
  end if;

  v_gateway_key := nullif(v_headers ->> 'x-resume-studio-mcp-gateway', '');
  if v_gateway_key is null or not exists (
    select 1
    from public.cv_mcp_gateway_config c
    where c.singleton
      and c.gateway_key_sha256 = encode(extensions.digest(v_gateway_key, 'sha256'), 'hex')
  ) then
    raise insufficient_privilege using
      message = 'OAuth Data API access is restricted to the Resume Studio MCP gateway.';
  end if;
end;
$$;

revoke all on function public.check_resume_studio_request() from public;
grant execute on function public.check_resume_studio_request()
  to anon, authenticated, service_role, authenticator;

alter role authenticator set pgrst.db_pre_request = 'public.check_resume_studio_request';
notify pgrst, 'reload config';

create table if not exists public.cv_mcp_rate_limits (
  actor_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (length(client_id) between 1 and 512),
  scope text not null check (scope in ('read', 'mutation')),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (actor_id, client_id, scope)
);

alter table public.cv_mcp_rate_limits enable row level security;
revoke all on public.cv_mcp_rate_limits from public, anon, authenticated;

create table if not exists public.cv_mcp_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (length(client_id) between 1 and 512),
  operation text not null check (operation in (
    'get_connection_identity', 'list_cvs', 'get_cv', 'list_cv_revisions',
    'get_cv_revision', 'list_editing_sessions', 'get_editing_session',
    'list_cv_blocks', 'get_cv_block', 'get_block_version',
    'get_publication_state', 'get_supported_schemas', 'export_cv_revision',
    'propose_content_changes', 'propose_lifecycle_change',
    'apply_change_proposal', 'discard_change_proposal'
  )),
  target_identities jsonb not null default '{}'::jsonb
    check (jsonb_typeof(target_identities) = 'object')
    check (octet_length(target_identities::text) <= 8192),
  result text not null check (result in ('succeeded', 'failed', 'rate_limited')),
  error_code text check (error_code is null or length(error_code) between 1 and 128),
  occurred_at timestamptz not null default now()
);

alter table public.cv_mcp_audit_events enable row level security;
revoke all on public.cv_mcp_audit_events from public, anon, authenticated;
grant select on public.cv_mcp_audit_events to service_role;

create index if not exists cv_mcp_audit_events_actor_time_idx
  on public.cv_mcp_audit_events(actor_id, occurred_at desc);
create index if not exists cv_mcp_audit_events_client_time_idx
  on public.cv_mcp_audit_events(client_id, occurred_at desc);

create or replace function public.enforce_mcp_rate_limit(
  p_client_id text,
  p_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_client_id text := nullif((select auth.jwt() ->> 'client_id'), '');
  v_now timestamptz := clock_timestamp();
  v_limit integer;
  v_window_seconds integer := 60;
  v_window_started_at timestamptz;
  v_count integer;
  v_retry_after_seconds integer;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if v_client_id is null or v_client_id is distinct from p_client_id
    or length(v_client_id) not between 1 and 512 then
    raise exception 'The OAuth client identity is invalid.' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('read', 'mutation') then
    raise exception 'A valid MCP rate-limit scope is required.' using errcode = '22023';
  end if;

  v_limit := case p_scope
    when 'read' then 120
    when 'mutation' then 60
  end;

  insert into public.cv_mcp_rate_limits(
    actor_id, client_id, scope, window_started_at, request_count
  ) values (
    v_actor_id, v_client_id, p_scope, v_now, 1
  )
  on conflict (actor_id, client_id, scope) do update
  set
    window_started_at = case
      when public.cv_mcp_rate_limits.window_started_at
        + make_interval(secs => v_window_seconds) <= v_now
      then v_now
      else public.cv_mcp_rate_limits.window_started_at
    end,
    request_count = case
      when public.cv_mcp_rate_limits.window_started_at
        + make_interval(secs => v_window_seconds) <= v_now
      then 1
      else public.cv_mcp_rate_limits.request_count + 1
    end
  returning window_started_at, request_count
  into v_window_started_at, v_count;

  v_retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from (
      v_window_started_at + make_interval(secs => v_window_seconds) - v_now
    )))::integer
  );

  return jsonb_build_object(
    'allowed', v_count <= v_limit,
    'remaining', greatest(0, v_limit - v_count),
    'retryAfterSeconds', v_retry_after_seconds
  );
end;
$$;

revoke all on function public.enforce_mcp_rate_limit(text, text)
  from public, anon;
grant execute on function public.enforce_mcp_rate_limit(text, text)
  to authenticated;

create or replace function public.search_mcp_cv_block_ids(
  p_search text,
  p_kind text,
  p_include_archived boolean,
  p_limit integer
)
returns table(block_id uuid)
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_search text := trim(coalesce(p_search, ''));
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if length(v_search) not between 1 and 200 then
    raise exception 'Search must contain between one and 200 characters.' using errcode = '22023';
  end if;
  if p_kind is not null and p_kind not in (
    'experience', 'skill', 'certification', 'education', 'interest'
  ) then
    raise exception 'The CV Block kind is invalid.' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'The CV Block search limit is invalid.' using errcode = '22023';
  end if;

  return query
  select b.id
  from public.cv_blocks b
  left join public.cv_block_versions v on v.id = b.current_version_id
  where b.owner_id = v_actor_id
    and (coalesce(p_include_archived, false) or b.status = 'active')
    and (p_kind is null or b.kind = p_kind)
    and (
      b.title ilike '%' || v_search || '%'
      or coalesce(v.content, '{}'::jsonb)::text ilike '%' || v_search || '%'
      or exists (
        select 1
        from public.cv_block_contexts c
        where c.block_id = b.id
          and (
            coalesce(c.label, '') ilike '%' || v_search || '%'
            or coalesce(c.context_key, '') ilike '%' || v_search || '%'
            or coalesce(c.metadata, '{}'::jsonb)::text ilike '%' || v_search || '%'
          )
      )
    )
  order by b.updated_at desc
  limit p_limit;
end;
$$;

revoke all on function public.search_mcp_cv_block_ids(text, text, boolean, integer)
  from public, anon;
grant execute on function public.search_mcp_cv_block_ids(text, text, boolean, integer)
  to authenticated;

create or replace function public.record_mcp_audit_event(
  p_client_id text,
  p_operation text,
  p_target_identities jsonb,
  p_result text,
  p_error_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_client_id text := nullif((select auth.jwt() ->> 'client_id'), '');
  v_id uuid;
  v_key text;
  v_value jsonb;
  v_item jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if v_client_id is null or v_client_id is distinct from p_client_id
    or length(v_client_id) not between 1 and 512 then
    raise exception 'The OAuth client identity is invalid.' using errcode = '42501';
  end if;
  if p_operation is null or p_operation not in (
    'get_connection_identity', 'list_cvs', 'get_cv', 'list_cv_revisions',
    'get_cv_revision', 'list_editing_sessions', 'get_editing_session',
    'list_cv_blocks', 'get_cv_block', 'get_block_version',
    'get_publication_state', 'get_supported_schemas', 'export_cv_revision',
    'propose_content_changes', 'propose_lifecycle_change',
    'apply_change_proposal', 'discard_change_proposal'
  ) then
    raise exception 'A valid MCP operation is required.' using errcode = '22023';
  end if;
  if p_result is null or p_result not in ('succeeded', 'failed', 'rate_limited') then
    raise exception 'A valid MCP audit result is required.' using errcode = '22023';
  end if;
  if p_error_code is not null and length(p_error_code) not between 1 and 128 then
    raise exception 'The error code is invalid.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_target_identities, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_target_identities, '{}'::jsonb)::text) > 8192 then
    raise exception 'Target identities must be a bounded object.' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(coalesce(p_target_identities, '{}'::jsonb)) loop
    if v_key not in (
      'proposalIds', 'cvIds', 'blockIds', 'versionIds', 'revisionIds', 'editingSessionIds'
    ) then
      raise exception 'Unsupported target identity category.' using errcode = '22023';
    end if;
    v_value := p_target_identities -> v_key;
    if jsonb_typeof(v_value) <> 'array' or jsonb_array_length(v_value) > 100 then
      raise exception 'Target identity categories must be bounded arrays.' using errcode = '22023';
    end if;
    for v_item in select value from jsonb_array_elements(v_value) loop
      if jsonb_typeof(v_item) <> 'string' or length(v_item #>> '{}') not between 1 and 512 then
        raise exception 'Target identities must be bounded strings.' using errcode = '22023';
      end if;
    end loop;
  end loop;

  insert into public.cv_mcp_audit_events(
    actor_id, client_id, operation, target_identities, result, error_code
  ) values (
    v_actor_id,
    v_client_id,
    p_operation,
    coalesce(p_target_identities, '{}'::jsonb),
    p_result,
    p_error_code
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_mcp_audit_event(text, text, jsonb, text, text)
  from public, anon;
grant execute on function public.record_mcp_audit_event(text, text, jsonb, text, text)
  to authenticated;

create or replace function public.audit_mcp_change_proposal_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_client_id text := nullif((select auth.jwt() ->> 'client_id'), '');
  v_operation text;
  v_targets jsonb;
  v_target_key text;
begin
  if v_actor_id is null or v_client_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_operation := case
      when new.operation_type = 'edit_content' then 'propose_content_changes'
      else 'propose_lifecycle_change'
    end;
  elsif new.status is distinct from old.status and new.status = 'applied' then
    v_operation := 'apply_change_proposal';
  elsif new.status is distinct from old.status and new.status = 'discarded' then
    v_operation := 'discard_change_proposal';
  else
    return new;
  end if;

  v_target_key := case new.target_type
    when 'cv' then 'cvIds'
    when 'cv_block' then 'blockIds'
    when 'block_version' then 'versionIds'
    when 'cv_revision' then 'revisionIds'
    when 'editing_session' then 'editingSessionIds'
  end;
  v_targets := jsonb_build_object('proposalIds', jsonb_build_array(new.id));
  if new.target_cv_id is not null then
    v_targets := v_targets || jsonb_build_object(
      'cvIds', jsonb_build_array(new.target_cv_id)
    );
  end if;
  if v_target_key is not null then
    v_targets := v_targets || jsonb_build_object(v_target_key, jsonb_build_array(new.target_id));
  end if;

  insert into public.cv_mcp_audit_events(
    actor_id, client_id, operation, target_identities, result, error_code
  ) values (
    v_actor_id, v_client_id, v_operation, v_targets, 'succeeded', null
  );
  return new;
end;
$$;

revoke all on function public.audit_mcp_change_proposal_mutation()
  from public, anon, authenticated;

drop trigger if exists cv_change_proposals_mcp_audit on public.cv_change_proposals;
create trigger cv_change_proposals_mcp_audit
after insert or update of status on public.cv_change_proposals
for each row execute function public.audit_mcp_change_proposal_mutation();

commit;
