begin;

-- Abort the transaction before any backfill writes when a legacy Composition
-- cannot be represented by the one-Block-Version-per-CV-Block invariant.
do $$
declare
  duplicate_groups integer;
begin
  select count(*)
  into duplicate_groups
  from (
    select composition.cv_id, composition.block_id
    from public.cv_compositions as composition
    group by composition.cv_id, composition.block_id
    having count(*) > 1
  ) as duplicates;

  if duplicate_groups > 0 then
    raise exception
      'Cannot create initial CV Revisions: % duplicate CV Block identities require explicit cleanup.',
      duplicate_groups
      using errcode = '23514',
        hint = 'Remove the unintended selection, or duplicate the CV Block when both entries need independent identities.';
  end if;
end;
$$;

create table if not exists public.cv_revisions (
  id uuid primary key default gen_random_uuid(),
  cv_id uuid not null references public.cv_documents(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  base_revision_id uuid,
  theme_id text,
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  summary text,
  summary_provenance jsonb check (
    summary_provenance is null or jsonb_typeof(summary_provenance) = 'object'
  ),
  created_at timestamptz not null default now(),
  unique (cv_id, revision_number),
  unique (id, cv_id),
  foreign key (base_revision_id, cv_id)
    references public.cv_revisions (id, cv_id)
    on delete restrict,
  check (base_revision_id is null or base_revision_id <> id)
);

create table if not exists public.cv_revision_compositions (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null,
  cv_id uuid not null references public.cv_documents(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  block_id uuid not null references public.cv_blocks(id) on delete restrict,
  version_id uuid not null references public.cv_block_versions(id) on delete restrict,
  section text not null check (
    section in ('experience', 'skills', 'certifications', 'education', 'interests')
  ),
  display jsonb not null default '{}'::jsonb check (jsonb_typeof(display) = 'object'),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (revision_id, block_id),
  unique (revision_id, section, position),
  foreign key (revision_id, cv_id)
    references public.cv_revisions (id, cv_id)
    on delete restrict
);

alter table public.cv_documents
  add column if not exists published_revision_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cv_documents'::regclass
      and conname = 'cv_documents_published_revision_id_fkey'
  ) then
    alter table public.cv_documents
      add constraint cv_documents_published_revision_id_fkey
      foreign key (published_revision_id, id)
      references public.cv_revisions(id, cv_id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists cv_revisions_cv_id_number_idx
  on public.cv_revisions(cv_id, revision_number desc);
create index if not exists cv_revisions_owner_id_idx
  on public.cv_revisions(owner_id);
create index if not exists cv_revisions_base_revision_id_idx
  on public.cv_revisions(base_revision_id);
create index if not exists cv_documents_published_revision_id_idx
  on public.cv_documents(published_revision_id);
create index if not exists cv_revision_compositions_revision_id_idx
  on public.cv_revision_compositions(revision_id);
create index if not exists cv_revision_compositions_cv_id_idx
  on public.cv_revision_compositions(cv_id);
create index if not exists cv_revision_compositions_owner_id_idx
  on public.cv_revision_compositions(owner_id);
create index if not exists cv_revision_compositions_block_id_idx
  on public.cv_revision_compositions(block_id);
create index if not exists cv_revision_compositions_version_id_idx
  on public.cv_revision_compositions(version_id);

alter table public.cv_revisions enable row level security;
alter table public.cv_revision_compositions enable row level security;

drop policy if exists "Owners read their CV Revisions" on public.cv_revisions;
create policy "Owners read their CV Revisions"
on public.cv_revisions
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists "Owners read their CV Revision Compositions"
  on public.cv_revision_compositions;
create policy "Owners read their CV Revision Compositions"
on public.cv_revision_compositions
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

revoke all on public.cv_revisions from public, anon, authenticated;
revoke all on public.cv_revision_compositions from public, anon, authenticated;
grant select on public.cv_revisions to authenticated;
grant select on public.cv_revision_compositions to authenticated;

with inserted_revisions as (
  insert into public.cv_revisions (
    id,
    cv_id,
    owner_id,
    revision_number,
    base_revision_id,
    theme_id,
    profile,
    summary,
    summary_provenance,
    created_at
  )
  select
    gen_random_uuid(),
    document.id,
    document.owner_id,
    1,
    null,
    document.theme_id,
    document.profile,
    document.summary,
    document.summary_provenance,
    document.created_at
  from public.cv_documents as document
  where not exists (
    select 1
    from public.cv_revisions as existing
    where existing.cv_id = document.id
      and existing.revision_number = 1
  )
  returning id, cv_id
)
insert into public.cv_revision_compositions (
  revision_id,
  cv_id,
  owner_id,
  block_id,
  version_id,
  section,
  display,
  position,
  created_at
)
select
  revision.id,
  composition.cv_id,
  composition.owner_id,
  composition.block_id,
  composition.version_id,
  composition.section,
  composition.display,
  composition.position,
  composition.created_at
from public.cv_compositions as composition
join inserted_revisions as revision
  on revision.cv_id = composition.cv_id;

update public.cv_documents as document
set published_revision_id = revision.id
from public.cv_revisions as revision
where revision.cv_id = document.id
  and revision.revision_number = 1
  and document.status = 'published'
  and document.published_revision_id is null;

-- Transitional publication boundary. The legacy editor remains available until
-- Editing Sessions replace it, so publishing must atomically pin an immutable
-- Revision before the slug can become readable.
create or replace function public.publish_cv_document(
  p_cv_id uuid,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_revision_id uuid;
  document record;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid public slug is required.' using errcode = '23514';
  end if;

  select source.*
  into document
  from public.cv_documents as source
  where source.id = p_cv_id
    and source.owner_id = v_owner_id
  for update;

  if not found then
    raise exception 'CV not found.' using errcode = 'P0002';
  end if;

  v_revision_id := document.published_revision_id;

  if v_revision_id is null then
    select revision.id
    into v_revision_id
    from public.cv_revisions as revision
    where revision.cv_id = p_cv_id
      and revision.owner_id = v_owner_id
      and revision.revision_number = 1;
  end if;

  if v_revision_id is null then
    insert into public.cv_revisions (
      cv_id,
      owner_id,
      revision_number,
      theme_id,
      profile,
      summary,
      summary_provenance
    )
    values (
      p_cv_id,
      v_owner_id,
      1,
      document.theme_id,
      document.profile,
      document.summary,
      document.summary_provenance
    )
    returning id into v_revision_id;

    insert into public.cv_revision_compositions (
      revision_id,
      cv_id,
      owner_id,
      block_id,
      version_id,
      section,
      display,
      position,
      created_at
    )
    select
      v_revision_id,
      composition.cv_id,
      composition.owner_id,
      composition.block_id,
      composition.version_id,
      composition.section,
      composition.display,
      composition.position,
      composition.created_at
    from public.cv_compositions as composition
    where composition.cv_id = p_cv_id
      and composition.owner_id = v_owner_id;
  end if;

  update public.cv_documents
  set
    status = 'published',
    slug = p_slug,
    published_at = now(),
    published_revision_id = v_revision_id
  where id = p_cv_id
    and owner_id = v_owner_id;

  return p_cv_id;
end;
$$;

revoke all on function public.publish_cv_document(uuid, text)
from public, anon;
grant execute on function public.publish_cv_document(uuid, text)
to authenticated;

create or replace function public.reject_cv_revision_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'CV Revisions and their Compositions are immutable.'
    using errcode = '55000';
end;
$$;

revoke all on function public.reject_cv_revision_mutation()
from public, anon, authenticated;

drop trigger if exists reject_cv_revision_mutation on public.cv_revisions;
create trigger reject_cv_revision_mutation
before update or delete on public.cv_revisions
for each row execute function public.reject_cv_revision_mutation();

drop trigger if exists reject_cv_revision_composition_mutation
  on public.cv_revision_compositions;
create trigger reject_cv_revision_composition_mutation
before update or delete on public.cv_revision_compositions
for each row execute function public.reject_cv_revision_mutation();

commit;
