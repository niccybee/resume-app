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

alter table public.cv_block_versions drop constraint if exists cv_block_versions_source_type_check;
alter table public.cv_block_versions add constraint cv_block_versions_source_type_check
  check (source_type in ('human', 'ai', 'import', 'mcp'));

create or replace function public.validate_cv_block_proposal_content(
  p_kind text,
  p_schema_version text,
  p_content jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_schema_version <> '1' then
    raise exception 'Unsupported CV Block schema version.' using errcode = '22023';
  end if;
  if p_kind not in ('experience', 'skill', 'certification', 'education', 'interest')
    or jsonb_typeof(p_content) <> 'object' then
    raise exception 'Unsupported or malformed CV Block content.' using errcode = '22023';
  end if;
  if (p_kind = 'experience' and (jsonb_typeof(p_content->'text') <> 'string' or nullif(btrim(p_content->>'text'), '') is null))
    or (p_kind in ('skill', 'certification', 'interest') and (jsonb_typeof(p_content->'name') <> 'string' or nullif(btrim(p_content->>'name'), '') is null))
    or (p_kind = 'education' and (jsonb_typeof(p_content->'institution') <> 'string' or nullif(btrim(p_content->>'institution'), '') is null)) then
    raise exception 'CV Block content is missing its required field.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(p_content) field
    where (
      (p_kind = 'experience' and field.key in ('name', 'position', 'url', 'startDate', 'endDate', 'summary'))
      or (p_kind = 'skill' and field.key = 'level')
      or (p_kind = 'certification' and field.key in ('issuer', 'date', 'url'))
      or (p_kind = 'education' and field.key in ('url', 'area', 'studyType', 'startDate', 'endDate', 'score'))
    ) and jsonb_typeof(field.value) <> 'string'
  ) then
    raise exception 'CV Block content contains an invalid string field.' using errcode = '22023';
  end if;
  if exists (
    select 1 from (values
      ('experience', 'highlights'),
      ('skill', 'keywords'),
      ('education', 'courses'),
      ('interest', 'keywords')
    ) as array_field(kind, field)
    where array_field.kind = p_kind and p_content ? array_field.field
      and (
        jsonb_typeof(p_content->array_field.field) <> 'array'
        or exists (
          select 1 from jsonb_array_elements(p_content->array_field.field) item
          where jsonb_typeof(item) <> 'string'
        )
      )
  ) then
    raise exception 'CV Block content contains an invalid string array field.' using errcode = '22023';
  end if;
  return p_content;
end;
$$;

revoke all on function public.validate_cv_block_proposal_content(text, text, jsonb) from public, anon, authenticated;

create or replace function public.create_cv_content_change_proposal(
  p_schema_version text,
  p_target_session_id uuid,
  p_base_optimistic_version integer,
  p_normalized_operations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  editing_session public.cv_editing_sessions%rowtype;
  cv_document public.cv_documents%rowtype;
  block public.cv_blocks%rowtype;
  operation jsonb;
  normalized_operation jsonb;
  normalized_operations jsonb := '[]'::jsonb;
  blocks_diff jsonb := '[]'::jsonb;
  working_state jsonb;
  replacement_count integer := 0;
  proposal_id uuid;
  structured_diff jsonb;
begin
  if v_owner_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if p_schema_version <> '1' or jsonb_typeof(p_normalized_operations) <> 'array'
    or jsonb_array_length(p_normalized_operations) not between 1 and 50 then
    raise exception 'Unsupported content Change Proposal.' using errcode = '22023';
  end if;

  select source.* into editing_session
  from public.cv_editing_sessions source
  where source.id = p_target_session_id and source.owner_id = v_owner_id
  for share;
  if not found then raise exception 'Editing Session not found.' using errcode = 'P0002'; end if;
  if editing_session.status <> 'open' then raise exception 'Editing Session is not open.' using errcode = '55000'; end if;
  if editing_session.optimistic_version is distinct from p_base_optimistic_version then
    raise exception 'stale-proposal: Editing Session changed before proposal creation.' using errcode = '40001';
  end if;
  select source.* into cv_document from public.cv_documents source
  where source.id = editing_session.cv_id and source.owner_id = v_owner_id for share;
  if not found then raise exception 'CV not found.' using errcode = 'P0002'; end if;
  if cv_document.status = 'archived' then
    raise exception 'Archived CVs must be restored before proposing content changes.' using errcode = '55000';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_normalized_operations) item
    where item->>'type' = 'append_block_version'
    group by item->>'blockId' having count(*) > 1
  ) then
    raise exception 'A proposal can append at most one Version for each CV Block.' using errcode = '22023';
  end if;

  for operation in select value from jsonb_array_elements(p_normalized_operations)
  loop
    if operation->>'type' = 'append_block_version' then
      select source.* into block from public.cv_blocks source
      where source.id = nullif(operation->>'blockId', '')::uuid and source.owner_id = v_owner_id
      for share;
      if not found then raise exception 'CV Block not found.' using errcode = 'P0002'; end if;
      if block.status <> 'active' then raise exception 'Archived CV Blocks must be restored before editing.' using errcode = '55000'; end if;
      if block.current_version_id is distinct from nullif(operation->>'basedOnVersionId', '')::uuid then
        raise exception 'stale-block-version: %', jsonb_build_object(
          'blockId', block.id, 'currentVersionId', block.current_version_id
        ) using errcode = '40001';
      end if;
      if operation->>'kind' <> block.kind then
        raise exception 'CV Block kind does not match its identity.' using errcode = '22023';
      end if;
      perform public.validate_cv_block_proposal_content(
        block.kind, operation->>'schemaVersion', operation->'content'
      );
      normalized_operation := jsonb_build_object(
        'type', 'append_block_version',
        'blockId', block.id,
        'kind', block.kind,
        'basedOnVersionId', block.current_version_id,
        'schemaVersion', operation->>'schemaVersion',
        'content', operation->'content',
        'source', coalesce(operation->'source', jsonb_build_object('type', 'human'))
      );
      normalized_operations := normalized_operations || jsonb_build_array(normalized_operation);
      blocks_diff := blocks_diff || jsonb_build_array(jsonb_build_object(
        'blockId', block.id,
        'beforeVersionId', block.current_version_id,
        'after', operation->'content'
      ));
    elsif operation->>'type' = 'replace_working_state' then
      replacement_count := replacement_count + 1;
      if replacement_count > 1 then
        raise exception 'A proposal can replace the Working Composition only once.' using errcode = '22023';
      end if;
      working_state := public.validate_cv_proposed_working_state(v_owner_id, operation->'value');
      normalized_operations := normalized_operations || jsonb_build_array(
        jsonb_build_object('type', 'replace_working_state', 'value', working_state)
      );
    else
      raise exception 'Unsupported content Change Proposal operation.' using errcode = '22023';
    end if;
  end loop;

  structured_diff := jsonb_strip_nulls(jsonb_build_object(
    'blocks', blocks_diff,
    'workingComposition', case when replacement_count = 1 then jsonb_build_object(
      'beforeVersion', editing_session.optimistic_version,
      'after', working_state
    ) else null end
  ));

  insert into public.cv_change_proposals (
    owner_id, schema_version, operation_type, target_type, target_id, target_cv_id,
    base_optimistic_version, normalized_operations, structured_diff, warnings
  ) values (
    v_owner_id, p_schema_version, 'edit_content', 'editing_session', editing_session.id,
    editing_session.cv_id, p_base_optimistic_version, normalized_operations,
    structured_diff, '[]'::jsonb
  ) returning id into proposal_id;

  return public.get_cv_change_proposal(proposal_id);
end;
$$;

revoke all on function public.create_cv_content_change_proposal(text, uuid, integer, jsonb) from public, anon;
grant execute on function public.create_cv_content_change_proposal(text, uuid, integer, jsonb) to authenticated;

create or replace function public.apply_cv_content_change_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  change_proposal public.cv_change_proposals%rowtype;
  editing_session public.cv_editing_sessions%rowtype;
  cv_document public.cv_documents%rowtype;
  block public.cv_blocks%rowtype;
  operation jsonb;
  working_state jsonb;
  saved_version jsonb;
  block_ids jsonb := '[]'::jsonb;
  version_ids jsonb := '[]'::jsonb;
begin
  if v_owner_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select source.* into change_proposal from public.cv_change_proposals source
  where source.id = p_proposal_id and source.owner_id = v_owner_id for update;
  if not found then raise exception 'Change Proposal not found.' using errcode = 'P0002'; end if;
  if change_proposal.status = 'applied' then return public.get_cv_change_proposal(change_proposal.id); end if;
  if change_proposal.status in ('expired', 'invalidated') then return public.get_cv_change_proposal(change_proposal.id); end if;
  if change_proposal.status <> 'pending' or change_proposal.operation_type <> 'edit_content' then
    raise exception 'invalid-proposal-state: Change Proposal is not pending content work.' using errcode = '55000';
  end if;
  if change_proposal.expires_at < now() then
    update public.cv_change_proposals set status = 'expired' where id = change_proposal.id;
    return public.get_cv_change_proposal(change_proposal.id);
  end if;

  select source.* into editing_session from public.cv_editing_sessions source
  where source.id = change_proposal.target_id and source.owner_id = v_owner_id for update;
  if not found then raise exception 'Editing Session not found.' using errcode = 'P0002'; end if;
  if editing_session.status <> 'open'
    or editing_session.optimistic_version is distinct from change_proposal.base_optimistic_version then
    update public.cv_change_proposals set status = 'invalidated', result = jsonb_build_object(
      'target', public.get_cv_editing_session(editing_session.id)
    ) where id = change_proposal.id;
    return public.get_cv_change_proposal(change_proposal.id);
  end if;

  select source.* into cv_document from public.cv_documents source
  where source.id = editing_session.cv_id and source.owner_id = v_owner_id for update;
  if not found then raise exception 'CV not found.' using errcode = 'P0002'; end if;
  if cv_document.status = 'archived' then
    update public.cv_change_proposals set status = 'invalidated', result = jsonb_build_object(
      'code', 'invalid-lifecycle-transition', 'reason', 'archived-cv',
      'cvId', cv_document.id, 'status', cv_document.status
    ) where id = change_proposal.id;
    return public.get_cv_change_proposal(change_proposal.id);
  end if;
  if exists (
    select 1 from jsonb_array_elements(change_proposal.normalized_operations) item
    where item->>'type' = 'append_block_version'
    group by item->>'blockId' having count(*) > 1
  ) then
    raise exception 'A proposal can append at most one Version for each CV Block.' using errcode = '22023';
  end if;
  perform 1 from public.cv_blocks source
  join (
    select distinct (item->>'blockId')::uuid as block_id
    from jsonb_array_elements(change_proposal.normalized_operations) item
    where item->>'type' = 'append_block_version'
  ) proposed on proposed.block_id = source.id
  where source.owner_id = v_owner_id
  order by source.id
  for update of source;

  for operation in select value from jsonb_array_elements(change_proposal.normalized_operations)
  loop
    if operation->>'type' = 'append_block_version' then
      select source.* into block from public.cv_blocks source
      where source.id = (operation->>'blockId')::uuid and source.owner_id = v_owner_id;
      if not found then raise exception 'CV Block not found.' using errcode = 'P0002'; end if;
      if block.status <> 'active' or block.current_version_id is distinct from (operation->>'basedOnVersionId')::uuid then
        update public.cv_change_proposals set status = 'invalidated', result = jsonb_build_object(
          'code', 'stale-block-version', 'blockId', block.id, 'currentVersionId', block.current_version_id
        ) where id = change_proposal.id;
        return public.get_cv_change_proposal(change_proposal.id);
      end if;
      perform public.validate_cv_block_proposal_content(block.kind, operation->>'schemaVersion', operation->'content');
    elsif operation->>'type' = 'replace_working_state' then
      working_state := public.validate_cv_proposed_working_state(v_owner_id, operation->'value');
    else
      raise exception 'Unsupported content Change Proposal operation.' using errcode = '22023';
    end if;
  end loop;

  for operation in select value from jsonb_array_elements(change_proposal.normalized_operations)
  loop
    if operation->>'type' = 'append_block_version' then
      select public.save_cv_block_version(
        p_content := operation->'content',
        p_block_id := (operation->>'blockId')::uuid,
        p_kind := operation->>'kind',
        p_based_on_version_id := (operation->>'basedOnVersionId')::uuid,
        p_source_type := coalesce(operation #>> '{source,type}', 'human'),
        p_source_metadata := coalesce(operation->'source', '{}'::jsonb)
      ) into saved_version;
      block_ids := block_ids || jsonb_build_array(saved_version->>'blockId');
      version_ids := version_ids || jsonb_build_array(saved_version->>'id');
    end if;
  end loop;

  if working_state is not null then
    update public.cv_editing_sessions set
      working_name = working_state->>'name',
      working_theme_id = nullif(working_state->>'themeId', ''),
      working_profile = working_state->'profile',
      working_summary = nullif(working_state->>'summary', ''),
      working_summary_provenance = nullif(working_state->'summaryProvenance', 'null'::jsonb),
      optimistic_version = optimistic_version + 1,
      updated_at = now()
    where id = editing_session.id and owner_id = v_owner_id;
    delete from public.cv_editing_session_compositions
    where session_id = editing_session.id and owner_id = v_owner_id;
    insert into public.cv_editing_session_compositions (
      session_id, cv_id, owner_id, block_id, version_id, section, position, display
    ) select editing_session.id, editing_session.cv_id, v_owner_id,
        (selection->>'blockId')::uuid, (selection->>'versionId')::uuid,
        selection->>'section', (selection->>'order')::integer,
        coalesce(selection->'block', '{}'::jsonb) ||
          case when jsonb_typeof(selection->'group') = 'object'
            then jsonb_build_object('grouping', selection->'group') else '{}'::jsonb end
      from jsonb_array_elements(working_state->'selections') selection;
    block_ids := block_ids || coalesce((select jsonb_agg(selection->>'blockId') from jsonb_array_elements(working_state->'selections') selection), '[]'::jsonb);
    version_ids := version_ids || coalesce((select jsonb_agg(selection->>'versionId') from jsonb_array_elements(working_state->'selections') selection), '[]'::jsonb);
  else
    update public.cv_editing_sessions set optimistic_version = optimistic_version + 1, updated_at = now()
    where id = editing_session.id and owner_id = v_owner_id;
  end if;

  update public.cv_change_proposals set status = 'applied', applied_at = now(), result = jsonb_build_object(
    'editingSessionId', editing_session.id,
    'optimisticVersion', editing_session.optimistic_version + 1,
    'affectedIdentities', jsonb_build_object(
      'cvId', editing_session.cv_id, 'blockIds', block_ids, 'versionIds', version_ids
    )
  ) where id = change_proposal.id;
  return public.get_cv_change_proposal(change_proposal.id);
end;
$$;

revoke all on function public.apply_cv_content_change_proposal(uuid) from public, anon;
grant execute on function public.apply_cv_content_change_proposal(uuid) to authenticated;

commit;
