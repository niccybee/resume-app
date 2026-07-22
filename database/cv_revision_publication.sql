begin;

alter table public.cv_change_proposals drop constraint if exists cv_change_proposals_operation_type_check;
alter table public.cv_change_proposals add constraint cv_change_proposals_operation_type_check
  check (operation_type in (
    'edit_content', 'replace_working_state', 'copy_to_new_version', 'copy_for_new_role',
    'start_editing_session', 'resume_editing_session', 'finish_editing_session',
    'archive_editing_session', 'restore_editing_session', 'archive_cv', 'restore_cv',
    'archive_cv_block', 'restore_cv_block',
    'publish_revision', 'withdraw_publication'
  ));

revoke all on function public.publish_cv_document(uuid, text) from authenticated;
revoke all on function public.unpublish_cv_document(uuid) from authenticated;

create or replace function public.create_cv_publication_proposal(p_schema_version text, p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_type text := p_operation ->> 'type';
  v_target_type text := p_operation #>> '{target,type}';
  v_target_id uuid := nullif(p_operation #>> '{target,id}', '')::uuid;
  v_cv_id uuid := nullif(p_operation #>> '{target,cvId}', '')::uuid;
  v_slug text := lower(nullif(btrim(p_operation ->> 'slug'), ''));
  v_revision_id uuid;
  v_revision_number integer;
  v_current_revision_number integer;
  document public.cv_documents%rowtype;
  v_warnings jsonb := '[]'::jsonb;
  v_id uuid;
begin
  if v_owner_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if p_schema_version <> '1' or v_type not in ('publish_revision', 'withdraw_publication') then
    raise exception 'Unsupported publication Change Proposal operation.' using errcode = '22023';
  end if;

  if v_type = 'publish_revision' then
    if v_target_type <> 'cv_revision' or v_target_id is null or v_cv_id is null then
      raise exception 'Publishing requires an exact CV Revision target.' using errcode = '22023';
    end if;
    select revision.id, revision.revision_number into v_revision_id, v_revision_number
    from public.cv_revisions revision
    where revision.id = v_target_id and revision.cv_id = v_cv_id and revision.owner_id = v_owner_id;
    if not found then raise exception 'CV Revision not found.' using errcode = 'P0002'; end if;
    select source.* into document from public.cv_documents source
    where source.id = v_cv_id and source.owner_id = v_owner_id for share;
    if not found then raise exception 'CV not found.' using errcode = 'P0002'; end if;
    if document.status = 'archived' then raise exception 'Archived CVs must be restored before publication.' using errcode = '55000'; end if;
    if v_slug is null or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'A valid public slug is required.' using errcode = '22023'; end if;
    if document.slug is not null and document.slug <> v_slug then raise exception 'A published CV keeps its stable public slug.' using errcode = '22023'; end if;
    if exists (select 1 from public.cv_documents other where other.id <> v_cv_id and other.slug = v_slug) then
      raise exception 'That public slug is already in use.' using errcode = '23505';
    end if;
    select revision.revision_number into v_current_revision_number from public.cv_revisions revision
    where revision.id = document.published_revision_id and revision.cv_id = document.id;
    if v_current_revision_number is not null and v_revision_number < v_current_revision_number then
      v_warnings := jsonb_build_array(format('This rolls back the public CV to Revision %s.', v_revision_number));
    end if;
  else
    if v_target_type <> 'cv' or v_target_id is null then raise exception 'Withdrawal requires a CV target.' using errcode = '22023'; end if;
    v_cv_id := v_target_id;
    select source.* into document from public.cv_documents source
    where source.id = v_cv_id and source.owner_id = v_owner_id for share;
    if not found then raise exception 'CV not found.' using errcode = 'P0002'; end if;
    if document.status <> 'published' then raise exception 'CV is not currently published.' using errcode = '55000'; end if;
    v_revision_id := document.published_revision_id;
    v_slug := document.slug;
    v_warnings := '["Withdrawing publication immediately deactivates the public link without deleting its CV Revision."]'::jsonb;
  end if;

  insert into public.cv_change_proposals(
    owner_id, schema_version, operation_type, target_type, target_id, target_cv_id,
    base_optimistic_version, normalized_operations, structured_diff, warnings
  ) values (
    v_owner_id, '1', v_type, v_target_type, v_target_id, v_cv_id, null,
    jsonb_build_array(jsonb_set(p_operation, '{slug}', to_jsonb(v_slug), true)),
    jsonb_build_object('publication', jsonb_build_object(
      'slug', coalesce(document.slug, v_slug),
      'beforeStatus', document.status,
      'beforeRevisionId', document.published_revision_id,
      'afterRevisionId', case when v_type = 'publish_revision' then v_revision_id else null end
    )),
    v_warnings
  ) returning id into v_id;
  return public.get_cv_change_proposal(v_id);
end;
$$;
revoke all on function public.create_cv_publication_proposal(text, jsonb) from public, anon;
grant execute on function public.create_cv_publication_proposal(text, jsonb) to authenticated;

create or replace function public.apply_cv_publication_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  change_proposal public.cv_change_proposals%rowtype;
  document public.cv_documents%rowtype;
  v_operation jsonb;
  v_revision_id uuid;
  v_before_revision_id uuid;
  v_before_status text;
  v_slug text;
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
  if change_proposal.operation_type not in ('publish_revision', 'withdraw_publication') then
    raise exception 'Invalid publication Change Proposal.' using errcode = '22023';
  end if;

  v_operation := change_proposal.normalized_operations -> 0;
  v_before_revision_id := nullif(change_proposal.structured_diff #>> '{publication,beforeRevisionId}', '')::uuid;
  v_before_status := change_proposal.structured_diff #>> '{publication,beforeStatus}';
  select source.* into document from public.cv_documents source
  where source.id = change_proposal.target_cv_id and source.owner_id = v_owner_id for update;
  if not found then raise exception 'CV not found.' using errcode = 'P0002'; end if;
  if document.status::text is distinct from v_before_status
    or document.published_revision_id is distinct from v_before_revision_id then
    update public.cv_change_proposals set status = 'invalidated', result = jsonb_build_object('target', jsonb_build_object(
      'id', document.id, 'status', document.status, 'slug', document.slug, 'publishedRevisionId', document.published_revision_id
    )) where id = change_proposal.id;
    return public.get_cv_change_proposal(change_proposal.id);
  end if;

  if change_proposal.operation_type = 'publish_revision' then
    v_revision_id := change_proposal.target_id;
    v_slug := v_operation ->> 'slug';
    perform 1 from public.cv_revisions revision
    where revision.id = v_revision_id and revision.cv_id = change_proposal.target_cv_id and revision.owner_id = v_owner_id;
    if not found then raise exception 'CV Revision not found.' using errcode = 'P0002'; end if;
    if document.status = 'archived' then raise exception 'Archived CVs must be restored before publication.' using errcode = '55000'; end if;
    if document.slug is not null and document.slug <> v_slug then raise exception 'A published CV keeps its stable public slug.' using errcode = '22023'; end if;
    if exists (select 1 from public.cv_documents other where other.id <> document.id and other.slug = v_slug) then
      raise exception 'That public slug is already in use.' using errcode = '23505';
    end if;
    update public.cv_documents
    set status = 'published', slug = coalesce(document.slug, v_slug),
      published_revision_id = v_revision_id, published_at = now()
    where id = document.id and owner_id = v_owner_id;
    update public.cv_change_proposals set status = 'applied', applied_at = now(), result = jsonb_build_object(
      'cvId', document.id, 'revisionId', v_revision_id, 'slug', coalesce(document.slug, v_slug), 'status', 'published'
    ) where id = change_proposal.id;
  else
    if document.status <> 'published' then
      update public.cv_change_proposals set status = 'invalidated' where id = change_proposal.id;
      return public.get_cv_change_proposal(change_proposal.id);
    end if;
    update public.cv_documents set status = 'draft', published_at = null
    where id = document.id and owner_id = v_owner_id;
    update public.cv_change_proposals set status = 'applied', applied_at = now(), result = jsonb_build_object(
      'cvId', document.id, 'revisionId', document.published_revision_id, 'slug', document.slug, 'status', 'draft'
    ) where id = change_proposal.id;
  end if;
  return public.get_cv_change_proposal(change_proposal.id);
end;
$$;
revoke all on function public.apply_cv_publication_proposal(uuid) from public, anon;
grant execute on function public.apply_cv_publication_proposal(uuid) to authenticated;

commit;
