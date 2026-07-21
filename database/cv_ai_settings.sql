-- Server-only OpenRouter settings. Clients call the authenticated Nuxt server;
-- they cannot read the Vault secret reference or the decrypted secret directly.

create extension if not exists supabase_vault with schema vault;

create table if not exists public.cv_ai_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'openrouter' check (provider = 'openrouter'),
  model text not null default 'openrouter/auto' check (
    btrim(model) <> '' and length(model) <= 160
  ),
  vault_secret_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cv_ai_settings enable row level security;

drop policy if exists "No direct client access to CV AI settings"
on public.cv_ai_settings;

create policy "No direct client access to CV AI settings"
on public.cv_ai_settings
for all
to authenticated
using (false)
with check (false);

revoke all on public.cv_ai_settings from public, anon, authenticated;
grant all on public.cv_ai_settings to service_role;

create or replace function public.cv_ai_status(p_owner_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'configured', setting.owner_id is not null,
    'model', coalesce(setting.model, 'openrouter/auto'),
    'updatedAt', setting.updated_at
  )
  from (select p_owner_id as owner_id) as requested
  left join public.cv_ai_settings as setting on setting.owner_id = requested.owner_id;
$$;

create or replace function public.cv_ai_save(
  p_owner_id uuid,
  p_model text,
  p_api_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  setting public.cv_ai_settings%rowtype;
  secret_id uuid;
  secret_name text := 'resume-openrouter-' || p_owner_id::text;
begin
  select * into setting
  from public.cv_ai_settings
  where owner_id = p_owner_id
  for update;

  if setting.owner_id is not null then
    perform vault.update_secret(
      setting.vault_secret_id,
      p_api_key,
      secret_name,
      'Resume Studio OpenRouter API key',
      null
    );
    update public.cv_ai_settings
    set model = p_model, updated_at = now()
    where owner_id = p_owner_id;
  else
    select vault.create_secret(
      p_api_key,
      secret_name,
      'Resume Studio OpenRouter API key'
    ) into secret_id;
    insert into public.cv_ai_settings (owner_id, model, vault_secret_id)
    values (p_owner_id, p_model, secret_id);
  end if;

  return public.cv_ai_status(p_owner_id);
end;
$$;

create or replace function public.cv_ai_delete(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_id uuid;
begin
  delete from public.cv_ai_settings
  where owner_id = p_owner_id
  returning vault_secret_id into secret_id;

  if secret_id is not null then
    delete from vault.secrets where id = secret_id;
  end if;

  return jsonb_build_object(
    'configured', false,
    'model', 'openrouter/auto',
    'updatedAt', null
  );
end;
$$;

create or replace function public.cv_ai_credentials(p_owner_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'model', setting.model,
    'apiKey', secret.decrypted_secret
  )
  from public.cv_ai_settings as setting
  join vault.decrypted_secrets as secret
    on secret.id = setting.vault_secret_id
  where setting.owner_id = p_owner_id;
$$;

revoke all on function public.cv_ai_status(uuid) from public, anon, authenticated;
revoke all on function public.cv_ai_save(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cv_ai_delete(uuid) from public, anon, authenticated;
revoke all on function public.cv_ai_credentials(uuid) from public, anon, authenticated;

grant execute on function public.cv_ai_status(uuid) to service_role;
grant execute on function public.cv_ai_save(uuid, text, text) to service_role;
grant execute on function public.cv_ai_delete(uuid) to service_role;
grant execute on function public.cv_ai_credentials(uuid) to service_role;
