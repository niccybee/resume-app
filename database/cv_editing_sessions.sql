begin;

create table if not exists public.cv_editing_sessions (
  id uuid primary key default gen_random_uuid(),
  cv_id uuid not null references public.cv_documents(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  base_revision_id uuid not null,
  status text not null default 'open' check (
    status in ('open', 'finished', 'archived')
  ),
  optimistic_version integer not null default 1 check (optimistic_version > 0),
  working_name text not null check (btrim(working_name) <> ''),
  working_theme_id text,
  working_profile jsonb not null default '{}'::jsonb check (
    jsonb_typeof(working_profile) = 'object'
  ),
  working_summary text,
  working_summary_provenance jsonb check (
    working_summary_provenance is null
    or jsonb_typeof(working_summary_provenance) = 'object'
  ),
  finished_revision_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (id, cv_id),
  foreign key (base_revision_id, cv_id)
    references public.cv_revisions(id, cv_id)
    on delete restrict,
  foreign key (finished_revision_id, cv_id)
    references public.cv_revisions(id, cv_id)
    on delete restrict,
  check (
    (status = 'finished' and finished_revision_id is not null and finished_at is not null)
    or (status <> 'finished' and finished_revision_id is null and finished_at is null)
  )
);

create table if not exists public.cv_editing_session_compositions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
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
  unique (session_id, block_id),
  unique (session_id, section, position),
  foreign key (session_id, cv_id)
    references public.cv_editing_sessions(id, cv_id)
    on delete cascade
);

create index if not exists cv_editing_sessions_cv_id_idx
  on public.cv_editing_sessions(cv_id);
create index if not exists cv_editing_sessions_owner_id_idx
  on public.cv_editing_sessions(owner_id);
create index if not exists cv_editing_sessions_base_revision_id_idx
  on public.cv_editing_sessions(base_revision_id);
create index if not exists cv_editing_sessions_status_idx
  on public.cv_editing_sessions(cv_id, status, updated_at desc);
create index if not exists cv_editing_session_compositions_session_id_idx
  on public.cv_editing_session_compositions(session_id);
create index if not exists cv_editing_session_compositions_cv_id_idx
  on public.cv_editing_session_compositions(cv_id);
create index if not exists cv_editing_session_compositions_owner_id_idx
  on public.cv_editing_session_compositions(owner_id);
create index if not exists cv_editing_session_compositions_block_id_idx
  on public.cv_editing_session_compositions(block_id);
create index if not exists cv_editing_session_compositions_version_id_idx
  on public.cv_editing_session_compositions(version_id);

alter table public.cv_editing_sessions enable row level security;
alter table public.cv_editing_session_compositions enable row level security;

drop policy if exists "Owners read their Editing Sessions"
  on public.cv_editing_sessions;
create policy "Owners read their Editing Sessions"
on public.cv_editing_sessions
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists "Owners read their Working Compositions"
  on public.cv_editing_session_compositions;
create policy "Owners read their Working Compositions"
on public.cv_editing_session_compositions
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

revoke all on public.cv_editing_sessions from public, anon, authenticated;
revoke all on public.cv_editing_session_compositions from public, anon, authenticated;
grant select on public.cv_editing_sessions to authenticated;
grant select on public.cv_editing_session_compositions to authenticated;

create or replace function public.get_cv_editing_session(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', editing_session.id,
    'cv_id', editing_session.cv_id,
    'owner_id', editing_session.owner_id,
    'base_revision_id', editing_session.base_revision_id,
    'status', editing_session.status,
    'optimistic_version', editing_session.optimistic_version,
    'working_name', editing_session.working_name,
    'working_theme_id', editing_session.working_theme_id,
    'working_profile', editing_session.working_profile,
    'working_summary', editing_session.working_summary,
    'working_summary_provenance', editing_session.working_summary_provenance,
    'finished_revision_id', editing_session.finished_revision_id,
    'created_at', editing_session.created_at,
    'updated_at', editing_session.updated_at,
    'finished_at', editing_session.finished_at,
    'selections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'block_id', composition.block_id,
          'version_id', composition.version_id,
          'section', composition.section,
          'position', composition.position,
          'display', composition.display,
          'content', version.content,
          'source_type', version.source_type,
          'source_metadata', version.source_metadata
        )
        order by composition.section, composition.position
      )
      from public.cv_editing_session_compositions as composition
      join public.cv_block_versions as version
        on version.id = composition.version_id
        and version.block_id = composition.block_id
        and version.owner_id = editing_session.owner_id
      where composition.session_id = editing_session.id
        and composition.owner_id = editing_session.owner_id
    ), '[]'::jsonb)
  )
  from public.cv_editing_sessions as editing_session
  where editing_session.id = p_session_id
    and editing_session.owner_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.get_cv_editing_session(uuid)
from public, anon;
grant execute on function public.get_cv_editing_session(uuid)
to authenticated;

create or replace function public.start_cv_editing_session(
  p_cv_id uuid,
  p_base_revision_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_base_revision_id uuid;
  v_session_id uuid;
  document public.cv_documents%rowtype;
  base_revision public.cv_revisions%rowtype;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
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

  v_base_revision_id := coalesce(p_base_revision_id, (
    select revision.id
    from public.cv_revisions as revision
    where revision.cv_id = p_cv_id
      and revision.owner_id = v_owner_id
    order by revision.revision_number desc
    limit 1
  ));

  if v_base_revision_id is null and p_base_revision_id is null then
    insert into public.cv_revisions (
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
    values (
      p_cv_id,
      v_owner_id,
      1,
      null,
      document.theme_id,
      document.profile,
      document.summary,
      document.summary_provenance,
      document.created_at
    )
    returning id into v_base_revision_id;

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
      v_base_revision_id,
      p_cv_id,
      v_owner_id,
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

  select revision.*
  into base_revision
  from public.cv_revisions as revision
  where revision.id = v_base_revision_id
    and revision.cv_id = p_cv_id
    and revision.owner_id = v_owner_id;

  if not found then
    raise exception 'Base CV Revision not found.' using errcode = 'P0002';
  end if;

  insert into public.cv_editing_sessions (
    cv_id,
    owner_id,
    base_revision_id,
    working_name,
    working_theme_id,
    working_profile,
    working_summary,
    working_summary_provenance
  )
  values (
    p_cv_id,
    v_owner_id,
    v_base_revision_id,
    document.name,
    base_revision.theme_id,
    base_revision.profile,
    base_revision.summary,
    base_revision.summary_provenance
  )
  returning id into v_session_id;

  insert into public.cv_editing_session_compositions (
    session_id,
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
    v_session_id,
    p_cv_id,
    v_owner_id,
    composition.block_id,
    composition.version_id,
    composition.section,
    composition.display,
    composition.position,
    composition.created_at
  from public.cv_revision_compositions as composition
  where composition.revision_id = v_base_revision_id
    and composition.cv_id = p_cv_id
    and composition.owner_id = v_owner_id;

  return v_session_id;
end;
$$;

revoke all on function public.start_cv_editing_session(uuid, uuid)
from public, anon;
grant execute on function public.start_cv_editing_session(uuid, uuid)
to authenticated;

create or replace function public.save_cv_editing_session(
  p_session_id uuid,
  p_expected_version integer,
  p_name text,
  p_theme_id text,
  p_profile jsonb,
  p_summary text,
  p_summary_provenance jsonb,
  p_selections jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_updated_count integer;
  editing_session public.cv_editing_sessions%rowtype;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_expected_version is null then
    raise exception 'session-conflict: An optimistic version is required.'
      using errcode = '40001';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'A CV name is required.' using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_profile, '{}'::jsonb)) <> 'object' then
    raise exception 'CV profile must be an object.' using errcode = '23514';
  end if;

  if p_summary_provenance is not null
    and jsonb_typeof(p_summary_provenance) <> 'object' then
    raise exception 'Summary provenance must be an object.' using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_selections, '[]'::jsonb)) <> 'array' then
    raise exception 'Working Composition selections must be an array.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_selections, '[]'::jsonb)) as selection(
      block_id uuid,
      version_id uuid,
      section text,
      position integer,
      display jsonb
    )
    where selection.block_id is null
      or selection.version_id is null
      or selection.section not in (
        'experience', 'skills', 'certifications', 'education', 'interests'
      )
      or selection.position is null
      or selection.position < 0
      or jsonb_typeof(coalesce(selection.display, '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Working Composition contains an invalid selection.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_selections, '[]'::jsonb)) as selection(
      block_id uuid,
      version_id uuid,
      section text,
      position integer,
      display jsonb
    )
    group by selection.block_id
    having count(*) > 1
  ) then
    raise exception 'A Working Composition can include at most one Block Version from each CV Block.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_selections, '[]'::jsonb)) as selection(
      block_id uuid,
      version_id uuid,
      section text,
      position integer,
      display jsonb
    )
    group by selection.section, selection.position
    having count(*) > 1
  ) then
    raise exception 'Working Composition positions must be unique within each section.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_selections, '[]'::jsonb)) as selection(
      block_id uuid,
      version_id uuid,
      section text,
      position integer,
      display jsonb
    )
    left join public.cv_blocks as block
      on block.id = selection.block_id
      and block.owner_id = v_owner_id
    left join public.cv_block_versions as version
      on version.id = selection.version_id
      and version.block_id = selection.block_id
      and version.owner_id = v_owner_id
    where block.id is null or version.id is null
  ) then
    raise exception 'Working Composition references an unavailable CV Block or Block Version.'
      using errcode = '23503';
  end if;

  select source.*
  into editing_session
  from public.cv_editing_sessions as source
  where source.id = p_session_id
    and source.owner_id = v_owner_id
  for update;

  if not found then
    raise exception 'Editing Session not found.' using errcode = 'P0002';
  end if;

  if editing_session.status <> 'open' then
    raise exception 'Editing Session is not open.' using errcode = '55000';
  end if;

  if editing_session.optimistic_version is distinct from p_expected_version then
    raise exception 'session-conflict: Editing Session changed elsewhere.'
      using errcode = '40001';
  end if;

  update public.cv_editing_sessions
  set
    working_name = btrim(p_name),
    working_theme_id = p_theme_id,
    working_profile = coalesce(p_profile, '{}'::jsonb),
    working_summary = nullif(p_summary, ''),
    working_summary_provenance = p_summary_provenance,
    optimistic_version = optimistic_version + 1,
    updated_at = now()
  where id = p_session_id
    and owner_id = v_owner_id
    and status = 'open'
    and optimistic_version = p_expected_version;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'session-conflict: Editing Session changed elsewhere.'
      using errcode = '40001';
  end if;

  delete from public.cv_editing_session_compositions
  where session_id = p_session_id
    and owner_id = v_owner_id;

  insert into public.cv_editing_session_compositions (
    session_id,
    cv_id,
    owner_id,
    block_id,
    version_id,
    section,
    position,
    display
  )
  select
    p_session_id,
    editing_session.cv_id,
    v_owner_id,
    selection.block_id,
    selection.version_id,
    selection.section,
    selection.position,
    coalesce(selection.display, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_selections, '[]'::jsonb)) as selection(
    block_id uuid,
    version_id uuid,
    section text,
    position integer,
    display jsonb
  );

  return p_session_id;
end;
$$;

revoke all on function public.save_cv_editing_session(
  uuid, integer, text, text, jsonb, text, jsonb, jsonb
) from public, anon;
grant execute on function public.save_cv_editing_session(
  uuid, integer, text, text, jsonb, text, jsonb, jsonb
) to authenticated;

create or replace function public.finish_cv_editing_session(
  p_session_id uuid,
  p_expected_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_revision_id uuid;
  v_revision_number integer;
  editing_session public.cv_editing_sessions%rowtype;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_expected_version is null then
    raise exception 'session-conflict: An optimistic version is required.'
      using errcode = '40001';
  end if;

  select source.*
  into editing_session
  from public.cv_editing_sessions as source
  where source.id = p_session_id
    and source.owner_id = v_owner_id
  for update;

  if not found then
    raise exception 'Editing Session not found.' using errcode = 'P0002';
  end if;

  if editing_session.status = 'finished' then
    return editing_session.finished_revision_id;
  end if;

  if editing_session.status <> 'open' then
    raise exception 'Editing Session is not open.' using errcode = '55000';
  end if;

  if editing_session.optimistic_version is distinct from p_expected_version then
    raise exception 'session-conflict: Editing Session changed elsewhere.'
      using errcode = '40001';
  end if;

  perform 1
  from public.cv_documents as document
  where document.id = editing_session.cv_id
    and document.owner_id = v_owner_id
  for update;

  if not found then
    raise exception 'CV not found.' using errcode = 'P0002';
  end if;

  select coalesce(max(revision.revision_number), 0) + 1
  into v_revision_number
  from public.cv_revisions as revision
  where revision.cv_id = editing_session.cv_id;

  insert into public.cv_revisions (
    cv_id,
    owner_id,
    revision_number,
    base_revision_id,
    theme_id,
    profile,
    summary,
    summary_provenance
  )
  values (
    editing_session.cv_id,
    v_owner_id,
    v_revision_number,
    editing_session.base_revision_id,
    editing_session.working_theme_id,
    editing_session.working_profile,
    editing_session.working_summary,
    editing_session.working_summary_provenance
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
    editing_session.cv_id,
    v_owner_id,
    composition.block_id,
    composition.version_id,
    composition.section,
    composition.display,
    composition.position,
    composition.created_at
  from public.cv_editing_session_compositions as composition
  where composition.session_id = p_session_id
    and composition.owner_id = v_owner_id;

  update public.cv_editing_sessions
  set
    status = 'finished',
    finished_revision_id = v_revision_id,
    optimistic_version = optimistic_version + 1,
    updated_at = now(),
    finished_at = now()
  where id = p_session_id
    and owner_id = v_owner_id
    and status = 'open'
    and optimistic_version = p_expected_version;

  return v_revision_id;
end;
$$;

revoke all on function public.finish_cv_editing_session(uuid, integer)
from public, anon;
grant execute on function public.finish_cv_editing_session(uuid, integer)
to authenticated;

commit;
