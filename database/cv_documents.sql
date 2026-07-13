create table public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  slug text unique check (
    slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  status text not null default 'draft' check (status in ('draft', 'published')),
  theme_id text,
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  summary text,
  summary_provenance jsonb check (
    summary_provenance is null or jsonb_typeof(summary_provenance) = 'object'
  ),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'draft') or
    (status = 'published' and slug is not null and published_at is not null)
  )
);

create table public.cv_compositions (
  id uuid primary key default gen_random_uuid(),
  cv_id uuid not null references public.cv_documents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  block_id uuid not null references public.cv_blocks(id) on delete restrict,
  version_id uuid not null references public.cv_block_versions(id) on delete restrict,
  section text not null check (
    section in ('experience', 'skills', 'certifications', 'education', 'interests')
  ),
  display jsonb not null default '{}'::jsonb check (jsonb_typeof(display) = 'object'),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (cv_id, version_id),
  unique (cv_id, section, position)
);

create index cv_documents_owner_id_idx on public.cv_documents(owner_id);
create index cv_documents_owner_updated_idx on public.cv_documents(owner_id, updated_at desc);
create index cv_documents_published_slug_idx
  on public.cv_documents(slug) where status = 'published';
create index cv_compositions_cv_id_idx on public.cv_compositions(cv_id);
create index cv_compositions_owner_id_idx on public.cv_compositions(owner_id);
create index cv_compositions_block_id_idx on public.cv_compositions(block_id);
create index cv_compositions_version_id_idx on public.cv_compositions(version_id);

alter table public.cv_documents enable row level security;
alter table public.cv_compositions enable row level security;

create policy "Owners manage their CV documents"
on public.cv_documents
for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "Visitors read published CV documents"
on public.cv_documents
for select
to anon
using (status = 'published');

create policy "Owners manage their CV compositions"
on public.cv_compositions
for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_id
  and exists (
    select 1 from public.cv_documents document
    where document.id = cv_id and document.owner_id = (select auth.uid())
  )
  and exists (
    select 1 from public.cv_blocks block
    where block.id = block_id and block.owner_id = (select auth.uid())
  )
  and exists (
    select 1 from public.cv_block_versions version
    where version.id = version_id
      and version.block_id = cv_compositions.block_id
      and version.owner_id = (select auth.uid())
  )
);

create policy "Visitors read published CV compositions"
on public.cv_compositions
for select
to anon
using (
  exists (
    select 1 from public.cv_documents document
    where document.id = cv_id and document.status = 'published'
  )
);

create policy "Visitors read versions used by published CVs"
on public.cv_block_versions
for select
to anon
using (
  exists (
    select 1
    from public.cv_compositions composition
    join public.cv_documents document on document.id = composition.cv_id
    where composition.version_id = cv_block_versions.id
      and document.status = 'published'
  )
);

grant select, insert, update, delete on public.cv_documents to authenticated;
grant select, insert, update, delete on public.cv_compositions to authenticated;
revoke all on public.cv_documents from anon;
revoke all on public.cv_compositions from anon;
grant select on public.cv_documents to anon;
grant select on public.cv_compositions to anon;
grant select on public.cv_block_versions to anon;

create or replace function public.touch_cv_document_updated_at()
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

revoke all on function public.touch_cv_document_updated_at()
from public, anon, authenticated;

create trigger touch_cv_document_updated_at
before update on public.cv_documents
for each row execute function public.touch_cv_document_updated_at();
