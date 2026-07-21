-- Server-only OpenRouter settings. Clients call the authenticated Edge Function;
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
