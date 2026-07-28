begin;

-- Keep MCP provenance in operation.source without treating it as the lifecycle target.
-- Only copy operations use source as their target; create and mutation operations use target.

create or replace function public.create_cv_lifecycle_proposal(p_schema_version text, p_operation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_type text := p_operation->>'type';
  v_target_type text := case
    when v_type in ('copy_to_new_version', 'copy_for_new_role')
      then p_operation #>> '{source,type}'
    else p_operation #>> '{target,type}'
  end;
  v_target_id uuid := (case
    when v_type in ('copy_to_new_version', 'copy_for_new_role')
      then p_operation #>> '{source,id}'
    else p_operation #>> '{target,id}'
  end)::uuid;
  v_cv_id uuid;
  v_base integer;
  v_base_revision_id uuid := nullif(p_operation->>'baseRevisionId', '')::uuid;
  v_base_version_id uuid := nullif(p_operation->>'baseVersionId', '')::uuid;
  v_status text;
  v_cv_status text;
  v_id uuid;
  v_context jsonb;
  v_state jsonb;
begin
  if v_owner_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if p_schema_version <> '1' or v_type not in (
    'start_editing_session', 'resume_editing_session', 'finish_editing_session',
    'copy_to_new_version', 'copy_for_new_role', 'archive_editing_session',
    'restore_editing_session', 'create_cv', 'archive_cv', 'restore_cv',
    'archive_cv_block', 'restore_cv_block', 'create_cv_block', 'duplicate_cv_block', 'delete_cv_block'
  ) then
    raise exception 'Unsupported lifecycle Change Proposal.' using errcode = '22023';
  end if;
  if v_type in ('copy_to_new_version', 'copy_for_new_role') and v_target_type not in ('editing_session', 'cv_revision')
    or v_type in ('resume_editing_session', 'finish_editing_session', 'archive_editing_session', 'restore_editing_session') and v_target_type <> 'editing_session'
    or v_type in ('create_cv', 'start_editing_session', 'archive_cv', 'restore_cv') and v_target_type <> 'cv'
    or v_type in ('archive_cv_block', 'restore_cv_block', 'create_cv_block', 'duplicate_cv_block', 'delete_cv_block') and v_target_type <> 'cv_block' then
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
  elsif v_target_type = 'cv' and v_type = 'create_cv' then
    if exists (
      select 1 from public.cv_documents
      where id = v_target_id
    ) then
      raise exception 'The proposed CV identity is already in use.' using errcode = '40001';
    end if;
    v_state := public.validate_cv_proposed_working_state(
      v_owner_id,
      p_operation->'value'
    );
    v_cv_id := null;
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
    if v_type = 'create_cv_block' then
      if nullif(btrim(p_operation->>'title'), '') is null then
        raise exception 'A CV Block title is required.' using errcode = '22023';
      end if;
      perform public.validate_cv_block_content(
        p_operation->>'kind',
        coalesce(p_operation->>'schemaVersion', '1'),
        p_operation->'content'
      );
      if jsonb_typeof(p_operation->'contexts') is distinct from 'array'
        or jsonb_array_length(p_operation->'contexts') <> 1 then
        raise exception 'A new CV Block requires one validated context.' using errcode = '22023';
      end if;
      v_context := p_operation->'contexts'->0;
      if jsonb_typeof(v_context) is distinct from 'object'
        or jsonb_typeof(v_context->'key') is distinct from 'string'
        or nullif(btrim(v_context->>'key'), '') is null
        or jsonb_typeof(v_context->'label') is distinct from 'string'
        or nullif(btrim(v_context->>'label'), '') is null
        or jsonb_typeof(v_context->'metadata') is distinct from 'object' then
        raise exception 'CV Block context is malformed.' using errcode = '22023';
      end if;
      if p_operation->>'kind' = 'experience' then
        if v_context->>'type' is distinct from 'employment'
          or nullif(btrim(v_context #>> '{metadata,employer}'), '') is null
          or nullif(btrim(v_context #>> '{metadata,role}'), '') is null
          or not public.is_valid_cv_block_date(v_context #>> '{metadata,startDate}')
          or (
            v_context #> '{metadata,endDate}' is not null
            and not public.is_valid_cv_block_date(v_context #>> '{metadata,endDate}')
          ) then
          raise exception 'An Experience Block requires a valid Employment Occasion.' using errcode = '22023';
        end if;
      elsif v_context->>'type' is distinct from 'sidebar'
        or v_context->>'key' is distinct from (case p_operation->>'kind'
          when 'skill' then 'skills'
          when 'certification' then 'certifications'
          when 'education' then 'education'
          when 'interest' then 'interests'
        end) then
        raise exception 'A sidebar CV Block requires a sidebar context.' using errcode = '22023';
      end if;
    else
      if v_base_version_id is null then raise exception 'A baseVersionId is required.' using errcode = '22023'; end if;
      select block.status into v_status from public.cv_blocks block
      where block.id = v_target_id and block.owner_id = v_owner_id
        and block.current_version_id = v_base_version_id for share;
      if not found then raise exception 'stale-block-version: CV Block changed.' using errcode = '40001'; end if;
      if v_type = 'archive_cv_block' and v_status <> 'active'
        or v_type = 'restore_cv_block' and v_status <> 'archived' then
        raise exception 'Invalid lifecycle transition.' using errcode = '55000';
      end if;
    end if;
    if v_type = 'archive_cv_block' and (
      exists (
        select 1 from public.cv_compositions composition
        join public.cv_documents document on document.id = composition.cv_id
        where composition.block_id = v_target_id and document.owner_id = v_owner_id and document.status <> 'archived'
      ) or exists (
        select 1 from public.cv_revision_compositions composition
        join public.cv_revisions revision on revision.id = composition.revision_id
        join public.cv_documents document on document.id = revision.cv_id
        where composition.block_id = v_target_id and document.owner_id = v_owner_id and document.status <> 'archived'
      )
    ) then raise exception 'CV Block is referenced by a non-archived CV Composition.' using errcode = '55000'; end if;
    if v_type = 'delete_cv_block' and exists (
      select 1 from public.cv_compositions where block_id = v_target_id and owner_id = v_owner_id
      union all
      select 1 from public.cv_revision_compositions where block_id = v_target_id and owner_id = v_owner_id
    ) then raise exception 'CV Block is referenced; archive it instead.' using errcode = '55000'; end if;
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
      case
        when v_type = 'copy_for_new_role' then jsonb_set(p_operation, '{name}', to_jsonb(btrim(p_operation->>'name')))
        when v_type = 'create_cv' then jsonb_set(p_operation, '{value}', v_state)
        when v_type = 'create_cv_block' or (v_type = 'duplicate_cv_block' and p_operation ? 'title')
          then jsonb_set(p_operation, '{title}', to_jsonb(btrim(p_operation->>'title')))
        else p_operation
      end
    ),
    case when v_type = 'create_cv' then
      jsonb_build_object('cv', jsonb_build_object(
        'operation', v_type,
        'target', jsonb_build_object('type', v_target_type, 'id', v_target_id),
        'after', v_state
      ))
    when v_type = 'create_cv_block' then
      jsonb_build_object('block', jsonb_build_object(
        'operation', v_type,
        'target', jsonb_build_object('type', v_target_type, 'id', v_target_id),
        'after', jsonb_build_object(
          'kind', p_operation->>'kind',
          'title', btrim(p_operation->>'title'),
          'schemaVersion', coalesce(p_operation->>'schemaVersion', '1'),
          'content', p_operation->'content',
          'contexts', p_operation->'contexts'
        )
      ))
    else
      jsonb_build_object('lifecycle', jsonb_build_object(
        'operation', v_type, 'target', jsonb_build_object('type', v_target_type, 'id', v_target_id),
        'baseRevisionId', v_base_revision_id, 'baseVersionId', v_base_version_id
      ))
    end,
    case when v_type = 'archive_cv' and v_status = 'published' then '["Archiving withdraws publication without changing shared CV Blocks."]'::jsonb else '[]'::jsonb end)
  returning id into v_id;
  return public.get_cv_change_proposal(v_id);
end; $$;
revoke all on function public.create_cv_lifecycle_proposal(text, jsonb) from public, anon;
grant execute on function public.create_cv_lifecycle_proposal(text, jsonb) to authenticated;

commit;
