begin;

alter table public.cv_editing_sessions alter column base_revision_id drop not null;
alter table public.cv_change_proposals drop constraint if exists cv_change_proposals_operation_type_check;
alter table public.cv_change_proposals drop constraint if exists cv_change_proposals_target_type_check;
alter table public.cv_change_proposals drop constraint if exists cv_change_proposals_target_id_fkey;
alter table public.cv_change_proposals alter column base_optimistic_version drop not null;
alter table public.cv_change_proposals alter column target_cv_id drop not null;
alter table public.cv_change_proposals drop constraint if exists cv_change_proposals_base_optimistic_version_check;
alter table public.cv_change_proposals add constraint cv_change_proposals_base_optimistic_version_check
  check (base_optimistic_version is null or base_optimistic_version > 0);
alter table public.cv_change_proposals add constraint cv_change_proposals_operation_type_check
  check (operation_type in (
    'edit_content', 'replace_working_state', 'copy_to_new_version', 'copy_for_new_role',
    'start_editing_session', 'resume_editing_session', 'finish_editing_session',
    'archive_editing_session', 'restore_editing_session', 'archive_cv', 'restore_cv',
    'archive_cv_block', 'restore_cv_block', 'publish_revision', 'withdraw_publication'
  ));
alter table public.cv_change_proposals add constraint cv_change_proposals_target_type_check
  check (target_type in ('editing_session', 'cv_revision', 'cv', 'cv_block'));
revoke execute on function public.start_cv_editing_session(uuid, uuid) from authenticated;
revoke execute on function public.finish_cv_editing_session(uuid, integer) from authenticated;
alter table public.cv_documents drop constraint if exists cv_documents_status_check;
alter table public.cv_documents add constraint cv_documents_status_check
  check (status in ('draft', 'published', 'archived'));
alter table public.cv_documents drop constraint if exists cv_documents_check;
alter table public.cv_documents drop constraint if exists cv_documents_publication_state_check;
alter table public.cv_documents add constraint cv_documents_publication_state_check check (
  status in ('draft', 'archived')
  or (status = 'published' and slug is not null and published_at is not null)
);

drop policy if exists "Owners manage their CV documents" on public.cv_documents;
drop policy if exists "Owners read their CV documents" on public.cv_documents;
create policy "Owners read their CV documents" on public.cv_documents
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);
revoke insert, update, delete on public.cv_documents from authenticated;
grant select on public.cv_documents to authenticated;
drop policy if exists "Owners create draft CV documents" on public.cv_documents;
create policy "Owners create draft CV documents" on public.cv_documents
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id and status = 'draft');
drop policy if exists "Owners update active CV content" on public.cv_documents;
create policy "Owners update active CV content" on public.cv_documents
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id and status <> 'archived')
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id and status <> 'archived');
grant insert (owner_id, name, theme_id, profile, summary, summary_provenance)
  on public.cv_documents to authenticated;
grant update (name, theme_id, profile, summary, summary_provenance)
  on public.cv_documents to authenticated;

drop policy if exists "Owners manage their CV compositions" on public.cv_compositions;
drop policy if exists "Owners read their CV compositions" on public.cv_compositions;
drop policy if exists "Owners manage active CV compositions" on public.cv_compositions;
create policy "Owners read their CV compositions" on public.cv_compositions
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);
create policy "Owners manage active CV compositions" on public.cv_compositions
  for all to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = owner_id
    and exists (
      select 1 from public.cv_documents document
      where document.id = cv_id
        and document.owner_id = (select auth.uid())
        and document.status <> 'archived'
    )
  )
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = owner_id
    and exists (
      select 1 from public.cv_documents document
      where document.id = cv_id
        and document.owner_id = (select auth.uid())
        and document.status <> 'archived'
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

create or replace function public.reject_archived_cv_session_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.cv_documents where id = new.cv_id and status = 'archived') then
    raise exception 'Archived CVs must be restored before Editing Session changes.' using errcode = '55000';
  end if;
  return new;
end; $$;
revoke all on function public.reject_archived_cv_session_mutation() from public, anon, authenticated;
drop trigger if exists reject_archived_cv_session_mutation on public.cv_editing_sessions;
create trigger reject_archived_cv_session_mutation
before insert or update on public.cv_editing_sessions
for each row execute function public.reject_archived_cv_session_mutation();

create or replace function public.reject_archived_cv_publication()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.status = 'archived' and new.status = 'published' then
    raise exception 'Archived CVs must be restored through a Change Proposal before publication.' using errcode = '55000';
  end if;
  return new;
end; $$;
revoke all on function public.reject_archived_cv_publication() from public, anon, authenticated;
drop trigger if exists reject_archived_cv_publication on public.cv_documents;
create trigger reject_archived_cv_publication before update on public.cv_documents
for each row execute function public.reject_archived_cv_publication();

create or replace function public.unpublish_cv_document(p_cv_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_owner_id uuid := (select auth.uid());
begin
  if v_owner_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if exists (select 1 from public.cv_documents where id = p_cv_id and owner_id = v_owner_id and status = 'archived') then
    raise exception 'Archived CVs must be restored before publication changes.' using errcode = '55000';
  end if;
  update public.cv_documents set status = 'draft', published_at = null
  where id = p_cv_id and owner_id = v_owner_id;
  if not found then raise exception 'CV not found.' using errcode = 'P0002'; end if;
  return p_cv_id;
end; $$;
revoke all on function public.unpublish_cv_document(uuid) from public, anon;
grant execute on function public.unpublish_cv_document(uuid) to authenticated;

create or replace function public.create_cv_lifecycle_proposal(p_schema_version text, p_operation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_type text := p_operation->>'type';
  v_target_type text := coalesce(p_operation #>> '{source,type}', p_operation #>> '{target,type}');
  v_target_id uuid := coalesce(p_operation #>> '{source,id}', p_operation #>> '{target,id}')::uuid;
  v_cv_id uuid;
  v_base integer;
  v_base_revision_id uuid := nullif(p_operation->>'baseRevisionId', '')::uuid;
  v_base_version_id uuid := nullif(p_operation->>'baseVersionId', '')::uuid;
  v_status text;
  v_cv_status text;
  v_id uuid;
begin
  if v_owner_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if p_schema_version <> '1' or v_type not in (
    'start_editing_session', 'resume_editing_session', 'finish_editing_session',
    'copy_to_new_version', 'copy_for_new_role', 'archive_editing_session',
    'restore_editing_session', 'archive_cv', 'restore_cv',
    'archive_cv_block', 'restore_cv_block'
  ) then
    raise exception 'Unsupported lifecycle Change Proposal.' using errcode = '22023';
  end if;
  if v_type in ('copy_to_new_version', 'copy_for_new_role') and v_target_type not in ('editing_session', 'cv_revision')
    or v_type in ('resume_editing_session', 'finish_editing_session', 'archive_editing_session', 'restore_editing_session') and v_target_type <> 'editing_session'
    or v_type in ('start_editing_session', 'archive_cv', 'restore_cv') and v_target_type <> 'cv'
    or v_type in ('archive_cv_block', 'restore_cv_block') and v_target_type <> 'cv_block' then
    raise exception 'Lifecycle operation and target types do not match.' using errcode = '22023';
  end if;
  if v_target_type = 'editing_session' and jsonb_typeof(p_operation->'baseOptimisticVersion') <> 'number' then
    raise exception 'An Editing Session base optimistic version is required.' using errcode = '22023';
  end if;
  if v_target_type = 'editing_session' then
    select cv_id, optimistic_version, status into v_cv_id, v_base, v_status
    from public.cv_editing_sessions where id = v_target_id and owner_id = v_owner_id for share;
    if not found then raise exception 'Editing Session not found.' using errcode = 'P0002'; end if;
    if v_base is distinct from (p_operation->>'baseOptimisticVersion')::integer then
      raise exception 'stale-proposal: Editing Session changed.' using errcode = '40001';
    end if;
  elsif v_target_type = 'cv_revision' then
    select cv_id into v_cv_id from public.cv_revisions where id = v_target_id and owner_id = v_owner_id;
    if not found then raise exception 'CV Revision not found.' using errcode = 'P0002'; end if;
    v_base := null;
  elsif v_target_type = 'cv' then
    select id, status into v_cv_id, v_status from public.cv_documents where id = v_target_id and owner_id = v_owner_id for share;
    if not found then raise exception 'CV not found.' using errcode = 'P0002'; end if;
    v_base := null;
    if v_type = 'start_editing_session' and v_base_revision_id is not null and not exists (
      select 1 from public.cv_revisions revision
      where revision.id = v_base_revision_id and revision.cv_id = v_cv_id and revision.owner_id = v_owner_id
    ) then raise exception 'Base CV Revision not found.' using errcode = 'P0002'; end if;
  elsif v_target_type = 'cv_block' then
    if v_base_version_id is null then raise exception 'A baseVersionId is required.' using errcode = '22023'; end if;
    select block.status into v_status from public.cv_blocks block
    where block.id = v_target_id and block.owner_id = v_owner_id
      and block.current_version_id = v_base_version_id for share;
    if not found then raise exception 'stale-block-version: CV Block changed.' using errcode = '40001'; end if;
    if v_type = 'archive_cv_block' and v_status <> 'active'
      or v_type = 'restore_cv_block' and v_status <> 'archived' then
      raise exception 'Invalid lifecycle transition.' using errcode = '55000';
    end if;
    if v_type = 'archive_cv_block' and (
      exists (
        select 1 from public.cv_compositions composition
        join public.cv_documents document on document.id = composition.cv_id
        where composition.block_id = v_target_id and document.owner_id = v_owner_id and document.status <> 'archived'
      ) or exists (
        select 1 from public.cv_editing_session_compositions composition
        join public.cv_documents document on document.id = composition.cv_id
        where composition.block_id = v_target_id and document.owner_id = v_owner_id and document.status <> 'archived'
      ) or exists (
        select 1 from public.cv_revision_compositions composition
        join public.cv_revisions revision on revision.id = composition.revision_id
        join public.cv_documents document on document.id = revision.cv_id
        where composition.block_id = v_target_id and document.owner_id = v_owner_id and document.status <> 'archived'
      )
    ) then raise exception 'CV Block is referenced by a non-archived CV Composition or Working Composition.' using errcode = '55000'; end if;
    v_cv_id := null;
    v_base := null;
  else raise exception 'Invalid lifecycle target.' using errcode = '22023';
  end if;
  if v_cv_id is not null then
    select status into v_cv_status from public.cv_documents where id = v_cv_id and owner_id = v_owner_id;
  end if;
  if v_type = 'copy_for_new_role' and nullif(btrim(p_operation->>'name'), '') is null then
    raise exception 'A new role-focused CV name is required.' using errcode = '22023';
  end if;
  if v_type in ('copy_to_new_version', 'copy_for_new_role') and v_target_type = 'editing_session' and v_status <> 'open' then
    raise exception 'Copy source Editing Session is not open.' using errcode = '55000';
  end if;
  if v_cv_status = 'archived' and v_type in ('start_editing_session', 'resume_editing_session', 'finish_editing_session', 'copy_to_new_version', 'archive_editing_session', 'restore_editing_session') then
    raise exception 'Archived CVs must be restored before this lifecycle operation.' using errcode = '55000';
  end if;
  if v_type = 'archive_editing_session' and v_status <> 'open'
    or v_type = 'restore_editing_session' and v_status <> 'archived'
    or v_type in ('resume_editing_session', 'finish_editing_session') and v_status <> 'open'
    or v_type = 'start_editing_session' and v_status = 'archived'
    or v_type = 'archive_cv' and v_status not in ('draft', 'published')
    or v_type = 'restore_cv' and v_status <> 'archived' then
    raise exception 'Invalid lifecycle transition.' using errcode = '55000';
  end if;
  insert into public.cv_change_proposals(owner_id, schema_version, operation_type, target_type, target_id, target_cv_id, base_optimistic_version, normalized_operations, structured_diff, warnings)
  values (v_owner_id, '1', v_type, v_target_type, v_target_id, v_cv_id, v_base, jsonb_build_array(
      case when v_type = 'copy_for_new_role' then jsonb_set(p_operation, '{name}', to_jsonb(btrim(p_operation->>'name'))) else p_operation end
    ),
    jsonb_build_object('lifecycle', jsonb_build_object(
      'operation', v_type, 'target', jsonb_build_object('type', v_target_type, 'id', v_target_id),
      'baseRevisionId', v_base_revision_id, 'baseVersionId', v_base_version_id
    )),
    case when v_type = 'archive_cv' and v_status = 'published' then '["Archiving withdraws publication without changing shared CV Blocks."]'::jsonb else '[]'::jsonb end)
  returning id into v_id;
  return public.get_cv_change_proposal(v_id);
end; $$;
revoke all on function public.create_cv_lifecycle_proposal(text, jsonb) from public, anon;
grant execute on function public.create_cv_lifecycle_proposal(text, jsonb) to authenticated;

create or replace function public.apply_cv_lifecycle_proposal(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner_id uuid := (select auth.uid());
  change_proposal public.cv_change_proposals%rowtype;
  source_session public.cv_editing_sessions%rowtype;
  source_revision public.cv_revisions%rowtype;
  source_block public.cv_blocks%rowtype;
  v_operation jsonb;
  v_new_cv_id uuid;
  v_new_session_id uuid;
  v_revision_id uuid;
  v_revision_number integer;
  v_published_revision_id uuid;
begin
  if v_owner_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select source.* into change_proposal from public.cv_change_proposals source
  where source.id = p_proposal_id and source.owner_id = v_owner_id for update;
  if not found then raise exception 'Change Proposal not found.' using errcode = 'P0002'; end if;
  if change_proposal.status = 'applied' then return public.get_cv_change_proposal(change_proposal.id); end if;
  if change_proposal.status <> 'pending' then raise exception 'invalid-proposal-state' using errcode = '55000'; end if;
  if change_proposal.expires_at < now() then
    update public.cv_change_proposals set status = 'expired' where id = change_proposal.id;
    return public.get_cv_change_proposal(change_proposal.id);
  end if;
  v_operation := change_proposal.normalized_operations->0;
  if change_proposal.operation_type = 'start_editing_session' then
    perform 1 from public.cv_documents document
    where document.id = change_proposal.target_id and document.owner_id = v_owner_id and document.status <> 'archived'
    for update;
    if not found then
      update public.cv_change_proposals set status = 'invalidated', result = jsonb_build_object('reason', 'invalid-lifecycle-transition') where id = change_proposal.id;
      return public.get_cv_change_proposal(change_proposal.id);
    end if;
    v_new_session_id := public.start_cv_editing_session(
      change_proposal.target_id,
      nullif(v_operation->>'baseRevisionId', '')::uuid
    );
    update public.cv_change_proposals set status = 'applied', applied_at = now(),
      result = jsonb_build_object('cvId', change_proposal.target_id, 'editingSessionId', v_new_session_id, 'optimisticVersion', 1)
    where id = change_proposal.id;
  elsif change_proposal.operation_type in ('resume_editing_session', 'finish_editing_session') then
    select source.* into source_session from public.cv_editing_sessions source
    where source.id = change_proposal.target_id and source.owner_id = v_owner_id for update;
    if not found or source_session.status <> 'open'
      or source_session.optimistic_version is distinct from change_proposal.base_optimistic_version then
      update public.cv_change_proposals set status = 'invalidated',
        result = jsonb_build_object('target', case when source_session.id is null then null else public.get_cv_editing_session(source_session.id) end)
      where id = change_proposal.id;
      return public.get_cv_change_proposal(change_proposal.id);
    end if;
    if change_proposal.operation_type = 'finish_editing_session' then
      select published_revision_id into v_published_revision_id from public.cv_documents
      where id = source_session.cv_id and owner_id = v_owner_id;
      v_revision_id := public.finish_cv_editing_session(source_session.id, source_session.optimistic_version);
      select revision_number into v_revision_number from public.cv_revisions
      where id = v_revision_id and cv_id = source_session.cv_id and owner_id = v_owner_id;
      update public.cv_change_proposals set status = 'applied', applied_at = now(), result = jsonb_build_object(
        'cvId', source_session.cv_id, 'editingSessionId', source_session.id,
        'optimisticVersion', source_session.optimistic_version + 1,
        'revisionId', v_revision_id, 'revisionNumber', v_revision_number,
        'publishedRevisionId', v_published_revision_id
      ) where id = change_proposal.id;
    else
      update public.cv_change_proposals set status = 'applied', applied_at = now(), result = jsonb_build_object(
        'cvId', source_session.cv_id, 'editingSessionId', source_session.id,
        'optimisticVersion', source_session.optimistic_version
      ) where id = change_proposal.id;
    end if;
  elsif change_proposal.operation_type in ('archive_cv_block', 'restore_cv_block') then
    select source.* into source_block from public.cv_blocks source
    where source.id = change_proposal.target_id and source.owner_id = v_owner_id for update;
    if not found or source_block.current_version_id is distinct from nullif(v_operation->>'baseVersionId', '')::uuid
      or change_proposal.operation_type = 'archive_cv_block' and source_block.status <> 'active'
      or change_proposal.operation_type = 'restore_cv_block' and source_block.status <> 'archived' then
      update public.cv_change_proposals set status = 'invalidated', result = jsonb_build_object(
        'blockId', change_proposal.target_id, 'currentVersionId', source_block.current_version_id,
        'reason', case
          when source_block.current_version_id is distinct from nullif(v_operation->>'baseVersionId', '')::uuid then 'stale-block-version'
          else 'invalid-lifecycle-transition'
        end
      ) where id = change_proposal.id;
      return public.get_cv_change_proposal(change_proposal.id);
    end if;
    if change_proposal.operation_type = 'archive_cv_block' and (
      exists (
        select 1 from public.cv_compositions composition
        join public.cv_documents document on document.id = composition.cv_id
        where composition.block_id = source_block.id and document.owner_id = v_owner_id and document.status <> 'archived'
      ) or exists (
        select 1 from public.cv_editing_session_compositions composition
        join public.cv_documents document on document.id = composition.cv_id
        where composition.block_id = source_block.id and document.owner_id = v_owner_id and document.status <> 'archived'
      ) or exists (
        select 1 from public.cv_revision_compositions composition
        join public.cv_revisions revision on revision.id = composition.revision_id
        join public.cv_documents document on document.id = revision.cv_id
        where composition.block_id = source_block.id and document.owner_id = v_owner_id and document.status <> 'archived'
      )
    ) then
      update public.cv_change_proposals set status = 'invalidated', result = jsonb_build_object(
        'blockId', source_block.id, 'reason', 'CV Block is referenced by a non-archived CV Composition or Working Composition.'
      ) where id = change_proposal.id;
      return public.get_cv_change_proposal(change_proposal.id);
    end if;
    perform public.set_cv_block_status(
      source_block.id,
      case when change_proposal.operation_type = 'archive_cv_block' then 'archived' else 'active' end
    );
    update public.cv_change_proposals set status = 'applied', applied_at = now(), result = jsonb_build_object(
      'blockId', source_block.id, 'versionId', source_block.current_version_id,
      'status', case when change_proposal.operation_type = 'archive_cv_block' then 'archived' else 'active' end
    ) where id = change_proposal.id;
  elsif change_proposal.operation_type in ('copy_to_new_version', 'copy_for_new_role') then
    if change_proposal.target_type = 'editing_session' then
      select source.* into source_session from public.cv_editing_sessions source
      where source.id = change_proposal.target_id and source.owner_id = v_owner_id for share;
      if source_session.status <> 'open' or source_session.optimistic_version is distinct from change_proposal.base_optimistic_version then
        update public.cv_change_proposals set status = 'invalidated', result = jsonb_build_object('target', public.get_cv_editing_session(source_session.id)) where id = change_proposal.id;
        return public.get_cv_change_proposal(change_proposal.id);
      end if;
    else
      select source.* into source_revision from public.cv_revisions source where source.id = change_proposal.target_id and source.owner_id = v_owner_id;
      if not found then raise exception 'Source CV Revision not found.' using errcode = 'P0002'; end if;
    end if;
    if change_proposal.operation_type = 'copy_for_new_role' then
      insert into public.cv_documents(owner_id, name, status, profile)
      values(v_owner_id, btrim(v_operation->>'name'), 'draft', '{}'::jsonb) returning id into v_new_cv_id;
    else v_new_cv_id := change_proposal.target_cv_id;
    end if;
    insert into public.cv_editing_sessions(cv_id, owner_id, base_revision_id, status, optimistic_version, working_name, working_theme_id, working_profile, working_summary, working_summary_provenance)
    values(v_new_cv_id, v_owner_id,
      case when change_proposal.operation_type = 'copy_for_new_role' then null when change_proposal.target_type = 'cv_revision' then source_revision.id else source_session.base_revision_id end,
      'open', 1,
      case when change_proposal.operation_type = 'copy_for_new_role' then btrim(v_operation->>'name') else (select name from public.cv_documents where id = v_new_cv_id) end,
      case when change_proposal.target_type = 'cv_revision' then source_revision.theme_id else source_session.working_theme_id end,
      case when change_proposal.target_type = 'cv_revision' then source_revision.profile else source_session.working_profile end,
      case when change_proposal.target_type = 'cv_revision' then source_revision.summary else source_session.working_summary end,
      case when change_proposal.target_type = 'cv_revision' then source_revision.summary_provenance else source_session.working_summary_provenance end)
    returning id into v_new_session_id;
    insert into public.cv_editing_session_compositions(session_id, cv_id, owner_id, block_id, version_id, section, position, display)
    select v_new_session_id, v_new_cv_id, v_owner_id, block_id, version_id, section, position, display
    from public.cv_editing_session_compositions where change_proposal.target_type = 'editing_session' and session_id = change_proposal.target_id
    union all
    select v_new_session_id, v_new_cv_id, v_owner_id, block_id, version_id, section, position, display
    from public.cv_revision_compositions where change_proposal.target_type = 'cv_revision' and revision_id = change_proposal.target_id;
    update public.cv_change_proposals set status = 'applied', applied_at = now(), result = jsonb_build_object('cvId', v_new_cv_id, 'editingSessionId', v_new_session_id, 'optimisticVersion', 1) where id = change_proposal.id;
  elsif change_proposal.operation_type in ('archive_editing_session', 'restore_editing_session') then
    select source.* into source_session from public.cv_editing_sessions source where source.id = change_proposal.target_id and source.owner_id = v_owner_id for update;
    if source_session.optimistic_version is distinct from change_proposal.base_optimistic_version
      or change_proposal.operation_type = 'archive_editing_session' and source_session.status <> 'open'
      or change_proposal.operation_type = 'restore_editing_session' and source_session.status <> 'archived' then
      update public.cv_change_proposals set status = 'invalidated', result = jsonb_build_object('target', public.get_cv_editing_session(source_session.id)) where id = change_proposal.id;
      return public.get_cv_change_proposal(change_proposal.id);
    end if;
    if change_proposal.operation_type = 'archive_editing_session' then
      update public.cv_editing_sessions set status = 'archived', optimistic_version = optimistic_version + 1, updated_at = now() where id = source_session.id;
    else
      update public.cv_editing_sessions set status = 'open', optimistic_version = optimistic_version + 1, updated_at = now() where id = source_session.id;
    end if;
    update public.cv_change_proposals set status = 'applied', applied_at = now(), result = jsonb_build_object('cvId', source_session.cv_id, 'editingSessionId', source_session.id, 'optimisticVersion', source_session.optimistic_version + 1) where id = change_proposal.id;
  else
    perform 1 from public.cv_documents document
    where document.id = change_proposal.target_id and document.owner_id = v_owner_id
      and ((change_proposal.operation_type = 'archive_cv' and document.status in ('draft', 'published'))
        or (change_proposal.operation_type = 'restore_cv' and document.status = 'archived'))
    for update;
    if not found then
      update public.cv_change_proposals set status = 'invalidated' where id = change_proposal.id;
      return public.get_cv_change_proposal(change_proposal.id);
    end if;
    if change_proposal.operation_type = 'archive_cv' then
      update public.cv_documents set status = 'archived', published_at = null where id = change_proposal.target_id and owner_id = v_owner_id and status in ('draft', 'published');
    else
      update public.cv_documents set status = 'draft' where id = change_proposal.target_id and owner_id = v_owner_id and status = 'archived';
    end if;
    update public.cv_change_proposals set status = 'applied', applied_at = now(), result = jsonb_build_object('cvId', change_proposal.target_id) where id = change_proposal.id;
  end if;
  return public.get_cv_change_proposal(change_proposal.id);
end; $$;
revoke all on function public.apply_cv_lifecycle_proposal(uuid) from public, anon;
grant execute on function public.apply_cv_lifecycle_proposal(uuid) to authenticated;

commit;
