begin;

create table if not exists public.cv_mcp_user_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.cv_mcp_user_settings is
  'Owner-controlled opt-in for Resume Studio MCP access.';

alter table public.cv_mcp_user_settings enable row level security;

drop policy if exists "Owners read their MCP setting"
  on public.cv_mcp_user_settings;
create policy "Owners read their MCP setting"
  on public.cv_mcp_user_settings
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners create their MCP setting"
  on public.cv_mcp_user_settings;
create policy "Owners create their MCP setting"
  on public.cv_mcp_user_settings
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners update their MCP setting"
  on public.cv_mcp_user_settings;
create policy "Owners update their MCP setting"
  on public.cv_mcp_user_settings
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

revoke all on public.cv_mcp_user_settings from public, anon, authenticated;
grant select, insert, update on public.cv_mcp_user_settings to authenticated;
grant all on public.cv_mcp_user_settings to service_role;

create schema if not exists private;

create or replace function private.touch_cv_mcp_user_settings()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_cv_mcp_user_settings() from public;

drop trigger if exists cv_mcp_user_settings_touch_updated_at
  on public.cv_mcp_user_settings;
create trigger cv_mcp_user_settings_touch_updated_at
before update on public.cv_mcp_user_settings
for each row execute function private.touch_cv_mcp_user_settings();

commit;
