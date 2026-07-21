begin;

-- Exclude legacy writers before verifying the final mutable state. These locks
-- are retained until commit, so no save can slip between the audit and the
-- write-surface contraction below.
lock table public.cv_documents, public.cv_compositions
in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.cv_documents as document
    where not exists (
      select 1
      from public.cv_revisions as revision
      where revision.cv_id = document.id
        and revision.theme_id is not distinct from document.theme_id
        and revision.profile is not distinct from document.profile
        and revision.summary is not distinct from document.summary
        and revision.summary_provenance is not distinct from document.summary_provenance
        and not exists (
          (
            select legacy.block_id, legacy.version_id, legacy.section,
              legacy.display, legacy.position
            from public.cv_compositions as legacy
            where legacy.cv_id = document.id
          )
          except
          (
            select migrated.block_id, migrated.version_id, migrated.section,
              migrated.display, migrated.position
            from public.cv_revision_compositions as migrated
            where migrated.revision_id = revision.id
          )
        )
        and not exists (
          (
            select migrated.block_id, migrated.version_id, migrated.section,
              migrated.display, migrated.position
            from public.cv_revision_compositions as migrated
            where migrated.revision_id = revision.id
          )
          except
          (
            select legacy.block_id, legacy.version_id, legacy.section,
              legacy.display, legacy.position
            from public.cv_compositions as legacy
            where legacy.cv_id = document.id
          )
        )
      )
  ) then
    raise exception 'Legacy CV Composition data has not been verified: mutable CV state has not been captured as one exact immutable CV Revision.' using errcode = '55000';
  end if;
end;
$$;

create or replace function public.create_cv_with_editing_session(p_state jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_state jsonb;
  v_cv_id uuid;
  v_session_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_state := public.validate_cv_proposed_working_state(v_owner_id, p_state);

  insert into public.cv_documents(owner_id, name, status, profile)
  values (v_owner_id, v_state->>'name', 'draft', '{}'::jsonb)
  returning id into v_cv_id;

  insert into public.cv_editing_sessions(
    cv_id, owner_id, base_revision_id, status, optimistic_version,
    working_name, working_theme_id, working_profile, working_summary,
    working_summary_provenance
  ) values (
    v_cv_id, v_owner_id, null, 'open', 1,
    v_state->>'name', nullif(v_state->>'themeId', ''), v_state->'profile',
    nullif(v_state->>'summary', ''), nullif(v_state->'summaryProvenance', 'null'::jsonb)
  ) returning id into v_session_id;

  insert into public.cv_editing_session_compositions(
    session_id, cv_id, owner_id, block_id, version_id, section, display, position
  )
  select
    v_session_id,
    v_cv_id,
    v_owner_id,
    (selection->>'blockId')::uuid,
    (selection->>'versionId')::uuid,
    selection->>'section',
    coalesce(selection->'block', '{}'::jsonb) ||
      case when selection ? 'group'
        then jsonb_build_object('grouping', selection->'group')
        else '{}'::jsonb
      end,
    (selection->>'order')::integer
  from jsonb_array_elements(v_state->'selections') as selection;

  return v_session_id;
end;
$$;

revoke all on function public.create_cv_with_editing_session(jsonb)
from public, anon;
grant execute on function public.create_cv_with_editing_session(jsonb)
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

  select source.* into document
  from public.cv_documents as source
  where source.id = p_cv_id and source.owner_id = v_owner_id
  for update;
  if not found then raise exception 'CV not found.' using errcode = 'P0002'; end if;
  if document.status = 'archived' then
    raise exception 'Archived CVs must be restored before editing.' using errcode = '55000';
  end if;

  v_base_revision_id := coalesce(p_base_revision_id, (
    select revision.id from public.cv_revisions as revision
    where revision.cv_id = p_cv_id and revision.owner_id = v_owner_id
    order by revision.revision_number desc limit 1
  ));

  if v_base_revision_id is null then
    insert into public.cv_editing_sessions(
      cv_id, owner_id, base_revision_id, working_name, working_profile
    ) values (
      p_cv_id, v_owner_id, null, document.name, '{}'::jsonb
    ) returning id into v_session_id;
    return v_session_id;
  end if;

  select revision.* into base_revision
  from public.cv_revisions as revision
  where revision.id = v_base_revision_id
    and revision.cv_id = p_cv_id
    and revision.owner_id = v_owner_id;
  if not found then raise exception 'Base CV Revision not found.' using errcode = 'P0002'; end if;

  insert into public.cv_editing_sessions(
    cv_id, owner_id, base_revision_id, working_name, working_theme_id,
    working_profile, working_summary, working_summary_provenance
  ) values (
    p_cv_id, v_owner_id, v_base_revision_id, document.name,
    base_revision.theme_id, base_revision.profile, base_revision.summary,
    base_revision.summary_provenance
  ) returning id into v_session_id;

  insert into public.cv_editing_session_compositions(
    session_id, cv_id, owner_id, block_id, version_id, section, display,
    position, created_at
  )
  select
    v_session_id, p_cv_id, v_owner_id, composition.block_id,
    composition.version_id, composition.section, composition.display,
    composition.position, composition.created_at
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

create or replace function public.contract_cv_lineage_content()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.theme_id := null;
    new.profile := '{}'::jsonb;
    new.summary := null;
    new.summary_provenance := null;
  elsif new.theme_id is distinct from old.theme_id
    or new.profile is distinct from old.profile
    or new.summary is distinct from old.summary
    or new.summary_provenance is distinct from old.summary_provenance then
    raise exception 'CV content must be changed through an Editing Session.' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function public.contract_cv_lineage_content()
from public, anon, authenticated;

drop trigger if exists contract_cv_lineage_content on public.cv_documents;
create trigger contract_cv_lineage_content
before insert or update on public.cv_documents
for each row execute function public.contract_cv_lineage_content();

create or replace function public.reject_legacy_cv_composition_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Legacy mutable CV Compositions are read-only after migration.' using errcode = '55000';
end;
$$;

revoke all on function public.reject_legacy_cv_composition_write()
from public, anon, authenticated;

drop trigger if exists reject_legacy_cv_composition_write on public.cv_compositions;
create trigger reject_legacy_cv_composition_write
before insert or update or delete on public.cv_compositions
for each row execute function public.reject_legacy_cv_composition_write();

revoke all on function public.save_cv_document(uuid, text, text, jsonb, text, jsonb, jsonb)
from authenticated;
revoke insert, update, delete on public.cv_documents from authenticated;
revoke insert (owner_id, name, theme_id, profile, summary, summary_provenance)
on public.cv_documents from authenticated;
revoke update (name, theme_id, profile, summary, summary_provenance)
on public.cv_documents from authenticated;
revoke all on public.cv_compositions from authenticated;
grant select on public.cv_compositions to authenticated;

drop policy if exists "Owners manage their CV documents" on public.cv_documents;
drop policy if exists "Owners create draft CV documents" on public.cv_documents;
drop policy if exists "Owners update active CV content" on public.cv_documents;
drop policy if exists "Owners manage their CV compositions" on public.cv_compositions;
drop policy if exists "Owners manage active CV compositions" on public.cv_compositions;
drop policy if exists "Owners read their CV documents" on public.cv_documents;
create policy "Owners read their CV documents"
on public.cv_documents for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);
drop policy if exists "Owners read their CV compositions" on public.cv_compositions;
create policy "Owners read their CV compositions"
on public.cv_compositions for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

commit;
