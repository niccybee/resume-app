begin;

create table if not exists public.cv_change_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  schema_version text not null check (schema_version = '1'),
  operation_type text not null check (operation_type = 'replace_working_state'),
  target_type text not null default 'editing_session' check (target_type = 'editing_session'),
  target_id uuid not null references public.cv_editing_sessions(id) on delete cascade,
  target_cv_id uuid not null references public.cv_documents(id) on delete cascade,
  base_optimistic_version integer not null check (base_optimistic_version > 0),
  normalized_operations jsonb not null,
  structured_diff jsonb not null,
  warnings jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'discarded', 'expired', 'invalidated')),
  result jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  applied_at timestamptz,
  discarded_at timestamptz,
  unique (id, owner_id)
);

create index if not exists cv_change_proposals_owner_target_idx
  on public.cv_change_proposals (owner_id, target_id, created_at desc);
create index if not exists cv_change_proposals_target_idx
  on public.cv_change_proposals (target_id);
create index if not exists cv_change_proposals_target_cv_idx
  on public.cv_change_proposals (target_cv_id);

alter table public.cv_change_proposals enable row level security;
drop policy if exists cv_change_proposals_select_own on public.cv_change_proposals;
create policy cv_change_proposals_select_own
  on public.cv_change_proposals for select to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.cv_change_proposals from public, anon, authenticated;
grant select on public.cv_change_proposals to authenticated;

create or replace function public.validate_cv_proposed_working_state(
  p_owner_id uuid,
  p_state jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_selection jsonb;
begin
  if jsonb_typeof(p_state) <> 'object'
    or jsonb_typeof(p_state->'name') <> 'string'
    or nullif(btrim(p_state->>'name'), '') is null
    or jsonb_typeof(coalesce(p_state->'profile', '{}'::jsonb)) <> 'object'
    or (p_state ? 'themeId' and jsonb_typeof(p_state->'themeId') not in ('string', 'null'))
    or (p_state ? 'summary' and jsonb_typeof(p_state->'summary') not in ('string', 'null'))
    or (p_state ? 'summaryProvenance' and jsonb_typeof(p_state->'summaryProvenance') not in ('object', 'null'))
    or jsonb_typeof(coalesce(p_state->'selections', '[]'::jsonb)) <> 'array' then
    raise exception 'Change Proposal Working Composition is malformed.' using errcode = '22023';
  end if;

  for v_selection in select value from jsonb_array_elements(coalesce(p_state->'selections', '[]'::jsonb))
  loop
    if jsonb_typeof(v_selection) <> 'object'
      or coalesce(v_selection->>'blockId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_selection->>'versionId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or v_selection->>'section' not in ('experience', 'skills', 'certifications', 'education', 'interests')
      or jsonb_typeof(v_selection->'order') <> 'number'
      or coalesce(v_selection->>'order', '') !~ '^\d+$'
      or (v_selection ? 'block' and jsonb_typeof(v_selection->'block') not in ('object', 'null'))
      or (v_selection ? 'group' and jsonb_typeof(v_selection->'group') not in ('object', 'null')) then
      raise exception 'Change Proposal contains a malformed Working Composition selection.' using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_state->'selections', '[]'::jsonb)) selection
    group by selection->>'blockId' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(coalesce(p_state->'selections', '[]'::jsonb)) selection
    group by selection->>'section', (selection->>'order')::integer having count(*) > 1
  ) then
    raise exception 'Working Composition violates uniqueness constraints.' using errcode = '23514';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_state->'selections', '[]'::jsonb)) selection
    left join public.cv_blocks block on block.id = (selection->>'blockId')::uuid and block.owner_id = p_owner_id
    left join public.cv_block_versions version on version.id = (selection->>'versionId')::uuid
      and version.block_id = block.id and version.owner_id = p_owner_id
    where block.id is null or version.id is null
  ) then
    raise exception 'Working Composition references an unavailable CV Block or Block Version.' using errcode = '23503';
  end if;

  return jsonb_build_object(
    'name', btrim(p_state->>'name'),
    'themeId', coalesce(p_state->'themeId', 'null'::jsonb),
    'profile', coalesce(p_state->'profile', '{}'::jsonb),
    'summary', coalesce(p_state->'summary', '""'::jsonb),
    'summaryProvenance', coalesce(p_state->'summaryProvenance', 'null'::jsonb),
    'selections', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'blockId', selection->>'blockId',
        'versionId', selection->>'versionId',
        'section', selection->>'section',
        'order', (selection->>'order')::integer,
        'block', selection->'block',
        'group', selection->'group'
      )) order by selection->>'section', (selection->>'order')::integer)
      from jsonb_array_elements(coalesce(p_state->'selections', '[]'::jsonb)) selection
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.validate_cv_proposed_working_state(uuid, jsonb) from public, anon, authenticated;

create or replace function public.get_cv_change_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select to_jsonb(change_proposal)
  into v_result
  from public.cv_change_proposals as change_proposal
  where change_proposal.id = p_proposal_id
    and change_proposal.owner_id = v_owner_id;

  if v_result is null then
    raise exception 'Change Proposal not found.' using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;

revoke all on function public.get_cv_change_proposal(uuid) from public, anon;
grant execute on function public.get_cv_change_proposal(uuid) to authenticated;

create or replace function public.create_cv_change_proposal(
  p_schema_version text,
  p_operation_type text,
  p_target_session_id uuid,
  p_base_optimistic_version integer,
  p_normalized_operations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_session public.cv_editing_sessions%rowtype;
  v_proposed_working_state jsonb;
  v_proposal_id uuid;
  v_diff jsonb;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_schema_version <> '1' or p_operation_type <> 'replace_working_state'
    or jsonb_typeof(p_normalized_operations) <> 'array'
    or jsonb_array_length(p_normalized_operations) <> 1
    or p_normalized_operations #>> '{0,type}' <> 'replace_working_state' then
    raise exception 'Unsupported Change Proposal operation.' using errcode = '22023';
  end if;

  select editing_session.*
  into v_session
  from public.cv_editing_sessions as editing_session
  where editing_session.id = p_target_session_id
    and editing_session.owner_id = v_owner_id
  for share;

  if not found then
    raise exception 'Editing Session not found.' using errcode = 'P0002';
  end if;
  if v_session.status <> 'open' then
    raise exception 'Editing Session is not open.' using errcode = '55000';
  end if;
  if v_session.optimistic_version is distinct from p_base_optimistic_version then
    raise exception 'stale-proposal: Editing Session changed before proposal creation.' using errcode = '40001';
  end if;

  v_proposed_working_state := public.validate_cv_proposed_working_state(
    v_owner_id,
    p_normalized_operations #> '{0,value}'
  );
  p_normalized_operations := jsonb_build_array(jsonb_build_object(
    'type', 'replace_working_state', 'value', v_proposed_working_state
  ));

  v_diff := jsonb_build_object(
    'fields',
      (case when to_jsonb(v_session.working_name) is distinct from v_proposed_working_state->'name'
        then jsonb_build_array(jsonb_build_object('path', 'name', 'before', v_session.working_name, 'after', v_proposed_working_state->>'name')) else '[]'::jsonb end) ||
      (case when coalesce(to_jsonb(v_session.working_theme_id), 'null'::jsonb) is distinct from v_proposed_working_state->'themeId'
        then jsonb_build_array(jsonb_build_object('path', 'themeId', 'before', v_session.working_theme_id, 'after', v_proposed_working_state->'themeId')) else '[]'::jsonb end) ||
      (case when v_session.working_profile is distinct from v_proposed_working_state->'profile'
        then jsonb_build_array(jsonb_build_object('path', 'profile', 'before', v_session.working_profile, 'after', v_proposed_working_state->'profile')) else '[]'::jsonb end) ||
      (case when to_jsonb(coalesce(v_session.working_summary, '')) is distinct from v_proposed_working_state->'summary'
        then jsonb_build_array(jsonb_build_object('path', 'summary', 'before', coalesce(v_session.working_summary, ''), 'after', coalesce(v_proposed_working_state->>'summary', ''))) else '[]'::jsonb end) ||
      (case when coalesce(v_session.working_summary_provenance, 'null'::jsonb) is distinct from v_proposed_working_state->'summaryProvenance'
        then jsonb_build_array(jsonb_build_object('path', 'summaryProvenance', 'before', v_session.working_summary_provenance, 'after', v_proposed_working_state->'summaryProvenance')) else '[]'::jsonb end),
    'composition', jsonb_build_object(
      'added', coalesce((select jsonb_agg(selection)
        from jsonb_array_elements(v_proposed_working_state->'selections') selection
        where not exists (select 1 from public.cv_editing_session_compositions current
          where current.session_id = v_session.id and current.block_id = (selection->>'blockId')::uuid)), '[]'::jsonb),
      'removed', coalesce((select jsonb_agg(jsonb_build_object(
        'blockId', composition.block_id, 'versionId', composition.version_id,
        'section', composition.section, 'order', composition.position, 'block', composition.display
      ) order by composition.section, composition.position)
      from public.cv_editing_session_compositions composition
      where composition.session_id = v_session.id and composition.owner_id = v_owner_id
        and not exists (select 1 from jsonb_array_elements(v_proposed_working_state->'selections') proposed
          where (proposed->>'blockId')::uuid = composition.block_id)), '[]'::jsonb),
      'replaced', coalesce((select jsonb_agg(jsonb_build_object(
        'before', jsonb_build_object('blockId', current.block_id, 'versionId', current.version_id, 'section', current.section, 'order', current.position),
        'after', proposed))
        from jsonb_array_elements(v_proposed_working_state->'selections') proposed
        join public.cv_editing_session_compositions current
          on current.session_id = v_session.id and current.block_id = (proposed->>'blockId')::uuid
        where current.version_id <> (proposed->>'versionId')::uuid), '[]'::jsonb),
      'moved', coalesce((select jsonb_agg(jsonb_build_object(
        'before', jsonb_build_object('blockId', current.block_id, 'versionId', current.version_id, 'section', current.section, 'order', current.position),
        'after', proposed))
        from jsonb_array_elements(v_proposed_working_state->'selections') proposed
        join public.cv_editing_session_compositions current
          on current.session_id = v_session.id and current.block_id = (proposed->>'blockId')::uuid
        where current.version_id = (proposed->>'versionId')::uuid
          and (current.section <> proposed->>'section' or current.position <> (proposed->>'order')::integer)), '[]'::jsonb),
      'changed', coalesce((select jsonb_agg(jsonb_build_object(
        'before', jsonb_build_object('blockId', current.block_id, 'versionId', current.version_id, 'block', current.display),
        'after', proposed))
        from jsonb_array_elements(v_proposed_working_state->'selections') proposed
        join public.cv_editing_session_compositions current
          on current.session_id = v_session.id and current.block_id = (proposed->>'blockId')::uuid
        where current.version_id = (proposed->>'versionId')::uuid
          and current.display is distinct from (
            coalesce(proposed->'block', '{}'::jsonb) ||
            case when jsonb_typeof(proposed->'group') = 'object'
              then jsonb_build_object('grouping', proposed->'group') else '{}'::jsonb end
          )), '[]'::jsonb)
    )
  );

  insert into public.cv_change_proposals (
    owner_id, schema_version, operation_type, target_id, target_cv_id,
    base_optimistic_version, normalized_operations, structured_diff
  ) values (
    v_owner_id, p_schema_version, p_operation_type, v_session.id, v_session.cv_id,
    p_base_optimistic_version, p_normalized_operations, v_diff
  ) returning id into v_proposal_id;

  return public.get_cv_change_proposal(v_proposal_id);
end;
$$;

revoke all on function public.create_cv_change_proposal(text, text, uuid, integer, jsonb) from public, anon;
grant execute on function public.create_cv_change_proposal(text, text, uuid, integer, jsonb) to authenticated;

create or replace function public.apply_cv_change_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  change_proposal public.cv_change_proposals%rowtype;
  editing_session public.cv_editing_sessions%rowtype;
  v_proposed_working_state jsonb;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select source.* into change_proposal
  from public.cv_change_proposals source
  where source.id = p_proposal_id and source.owner_id = v_owner_id
  for update;
  if not found then raise exception 'Change Proposal not found.' using errcode = 'P0002'; end if;
  if change_proposal.status = 'applied' then
    return public.get_cv_change_proposal(change_proposal.id);
  end if;
  if change_proposal.status in ('expired', 'invalidated') then
    return public.get_cv_change_proposal(change_proposal.id);
  end if;
  if change_proposal.status <> 'pending' then
    raise exception 'invalid-proposal-state: Change Proposal is not pending.' using errcode = '55000';
  end if;
  if change_proposal.expires_at < now() then
    update public.cv_change_proposals set status = 'expired' where id = change_proposal.id;
    return public.get_cv_change_proposal(change_proposal.id);
  end if;

  select source.* into editing_session
  from public.cv_editing_sessions source
  where source.id = change_proposal.target_id and source.owner_id = v_owner_id
  for update;
  if not found then raise exception 'Editing Session not found.' using errcode = 'P0002'; end if;
  if editing_session.status <> 'open'
    or editing_session.optimistic_version is distinct from change_proposal.base_optimistic_version then
    update public.cv_change_proposals
    set status = 'invalidated', result = jsonb_build_object(
      'target', public.get_cv_editing_session(editing_session.id)
    ) where id = change_proposal.id;
    return public.get_cv_change_proposal(change_proposal.id);
  end if;

  v_proposed_working_state := change_proposal.normalized_operations #> '{0,value}';
  if change_proposal.schema_version <> '1'
    or change_proposal.operation_type <> 'replace_working_state'
    or change_proposal.normalized_operations #>> '{0,type}' <> 'replace_working_state' then
    raise exception 'Unsupported Change Proposal schema or operation.' using errcode = '22023';
  end if;
  v_proposed_working_state := public.validate_cv_proposed_working_state(
    v_owner_id,
    v_proposed_working_state
  );
  update public.cv_editing_sessions
  set working_name = v_proposed_working_state->>'name',
      working_theme_id = nullif(v_proposed_working_state->>'themeId', ''),
      working_profile = v_proposed_working_state->'profile',
      working_summary = nullif(v_proposed_working_state->>'summary', ''),
      working_summary_provenance = nullif(v_proposed_working_state->'summaryProvenance', 'null'::jsonb),
      optimistic_version = optimistic_version + 1,
      updated_at = now()
  where id = editing_session.id and owner_id = v_owner_id
    and status = 'open' and optimistic_version = change_proposal.base_optimistic_version;

  delete from public.cv_editing_session_compositions
  where session_id = editing_session.id and owner_id = v_owner_id;
  insert into public.cv_editing_session_compositions (
    session_id, cv_id, owner_id, block_id, version_id, section, position, display
  ) select editing_session.id, editing_session.cv_id, v_owner_id,
      (selection->>'blockId')::uuid, (selection->>'versionId')::uuid,
      selection->>'section', (selection->>'order')::integer,
      coalesce(selection->'block', '{}'::jsonb) ||
        case when jsonb_typeof(selection->'group') = 'object'
          then jsonb_build_object('grouping', selection->'group') else '{}'::jsonb end
    from jsonb_array_elements(v_proposed_working_state->'selections') selection;

  update public.cv_change_proposals
  set status = 'applied', applied_at = now(), result = jsonb_build_object(
    'editingSessionId', editing_session.id,
    'optimisticVersion', editing_session.optimistic_version + 1,
    'affectedIdentities', jsonb_build_object(
      'cvId', editing_session.cv_id,
      'blockIds', coalesce((select jsonb_agg(selection->>'blockId') from jsonb_array_elements(v_proposed_working_state->'selections') selection), '[]'::jsonb),
      'versionIds', coalesce((select jsonb_agg(selection->>'versionId') from jsonb_array_elements(v_proposed_working_state->'selections') selection), '[]'::jsonb)
    )
  ) where id = change_proposal.id;
  return public.get_cv_change_proposal(change_proposal.id);
end;
$$;

revoke all on function public.apply_cv_change_proposal(uuid) from public, anon;
grant execute on function public.apply_cv_change_proposal(uuid) to authenticated;

create or replace function public.discard_cv_change_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  change_proposal public.cv_change_proposals%rowtype;
begin
  if v_owner_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select source.* into change_proposal from public.cv_change_proposals source
  where source.id = p_proposal_id and source.owner_id = v_owner_id for update;
  if not found then raise exception 'Change Proposal not found.' using errcode = 'P0002'; end if;
  if change_proposal.status = 'discarded' then return public.get_cv_change_proposal(change_proposal.id); end if;
  if change_proposal.status <> 'pending' then
    raise exception 'invalid-proposal-state: Change Proposal is not pending.' using errcode = '55000';
  end if;
  update public.cv_change_proposals set status = 'discarded', discarded_at = now()
  where id = change_proposal.id;
  return public.get_cv_change_proposal(change_proposal.id);
end;
$$;

revoke all on function public.discard_cv_change_proposal(uuid) from public, anon;
grant execute on function public.discard_cv_change_proposal(uuid) to authenticated;

commit;
