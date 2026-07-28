begin;

-- Lifecycle Change Proposals reserve a CV Block identity before saving its
-- first immutable Block Version. Treat an owned identity without a current
-- version as a first save, not as a revision that requires a base version.
create or replace function public.save_cv_block_version(
  p_content jsonb,
  p_block_id uuid default null,
  p_kind text default null,
  p_title text default null,
  p_based_on_version_id uuid default null,
  p_source_type text default 'human',
  p_source_metadata jsonb default '{}'::jsonb,
  p_contexts jsonb default null,
  p_schema_version text default '1'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_block public.cv_blocks%rowtype;
  base_version public.cv_block_versions%rowtype;
  v_version public.cv_block_versions%rowtype;
  v_version_number integer;
  v_context jsonb;
begin
  if v_owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  if p_block_id is null then
    if p_kind not in ('experience', 'skill', 'certification', 'education', 'interest') then
      raise exception 'A supported block kind is required' using errcode = '22023';
    end if;
    if nullif(btrim(p_title), '') is null then raise exception 'A block title is required' using errcode = '22023'; end if;
    if p_based_on_version_id is not null then
      raise exception 'A new CV Block identity cannot use based_on_version_id' using errcode = '23514';
    end if;
    perform public.validate_cv_block_content(p_kind, p_schema_version, p_content);
    insert into public.cv_blocks(owner_id, kind, title)
    values(v_owner_id, p_kind, btrim(p_title)) returning * into v_block;
  else
    select * into v_block from public.cv_blocks
    where id = p_block_id and owner_id = v_owner_id for update;
    if not found then raise exception 'Block not found' using errcode = 'P0002'; end if;
    if v_block.status = 'archived' then raise exception 'Restore this CV Block before appending a Block Version' using errcode = '55000'; end if;
    if v_block.current_version_id is null then
      if p_based_on_version_id is not null then
        raise exception 'A new CV Block identity cannot use based_on_version_id' using errcode = '23514';
      end if;
      if p_kind is not null and p_kind <> v_block.kind then
        raise exception 'Reserved CV Block kind does not match' using errcode = '23514';
      end if;
    else
      if v_block.current_version_id is distinct from p_based_on_version_id then
        raise exception 'This block has changed since the selected base version' using errcode = '40001';
      end if;
      select * into base_version from public.cv_block_versions
      where id = p_based_on_version_id and owner_id = v_owner_id;
      if not found or base_version.block_id <> v_block.id then
        raise exception 'Base Block Version must belong to the same CV Block identity' using errcode = '23514';
      end if;
    end if;
    perform public.validate_cv_block_content(v_block.kind, p_schema_version, p_content);
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.cv_block_versions where block_id = v_block.id;
  insert into public.cv_block_versions(
    block_id, owner_id, version_number, schema_version, content,
    source_type, source_metadata, based_on_version_id
  ) values (
    v_block.id, v_owner_id, v_version_number, p_schema_version, p_content,
    p_source_type, coalesce(p_source_metadata, '{}'::jsonb), p_based_on_version_id
  ) returning * into v_version;
  update public.cv_blocks set current_version_id = v_version.id, updated_at = now()
  where id = v_block.id and owner_id = v_owner_id;

  if p_contexts is not null then
    if jsonb_typeof(p_contexts) <> 'array' then raise exception 'Block contexts must be a JSON array' using errcode = '22023'; end if;
    delete from public.cv_block_contexts where block_id = v_block.id and owner_id = v_owner_id;
    for v_context in select value from jsonb_array_elements(p_contexts)
    loop
      insert into public.cv_block_contexts(block_id, owner_id, context_type, context_key, label, metadata)
      values(v_block.id, v_owner_id, v_context ->> 'type', v_context ->> 'key', v_context ->> 'label', coalesce(v_context -> 'metadata', '{}'::jsonb));
    end loop;
  end if;

  return jsonb_build_object(
    'id', v_version.id, 'blockId', v_version.block_id, 'number', v_version.version_number,
    'schemaVersion', v_version.schema_version, 'content', v_version.content,
    'source', jsonb_build_object('type', v_version.source_type) || v_version.source_metadata,
    'basedOnVersionId', v_version.based_on_version_id, 'createdAt', v_version.created_at
  );
end;
$$;

commit;
