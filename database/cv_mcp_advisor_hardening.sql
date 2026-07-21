begin;

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role, authenticator;

create or replace function private.check_resume_studio_request()
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

revoke all on function private.check_resume_studio_request() from public;
grant execute on function private.check_resume_studio_request()
  to anon, authenticated, service_role, authenticator;

alter role authenticator
  set pgrst.db_pre_request = 'private.check_resume_studio_request';
drop function if exists public.check_resume_studio_request();
notify pgrst, 'reload config';

create index if not exists cv_documents_published_revision_cv_idx
  on public.cv_documents(published_revision_id, id);
create index if not exists cv_revisions_base_revision_cv_idx
  on public.cv_revisions(base_revision_id, cv_id);
create index if not exists cv_revision_compositions_revision_cv_idx
  on public.cv_revision_compositions(revision_id, cv_id);
create index if not exists cv_editing_sessions_base_revision_cv_idx
  on public.cv_editing_sessions(base_revision_id, cv_id);
create index if not exists cv_editing_sessions_finished_revision_cv_idx
  on public.cv_editing_sessions(finished_revision_id, cv_id);
create index if not exists cv_editing_session_compositions_session_cv_idx
  on public.cv_editing_session_compositions(session_id, cv_id);

commit;
