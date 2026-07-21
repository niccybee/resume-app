begin;

alter table public.cv_block_versions
  add column if not exists schema_version text not null default '1';

create or replace function public.validate_cv_block_content(
  p_kind text,
  p_schema_version text,
  p_content jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_schema_version <> '1' then
    raise exception 'Unsupported CV Block schema version: %', p_schema_version using errcode = '22023';
  end if;
  if p_kind not in ('experience', 'skill', 'certification', 'education', 'interest') then
    raise exception 'Unsupported CV Block kind: %', p_kind using errcode = '22023';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'CV Block content must be an object' using errcode = '22023';
  end if;

  if p_kind = 'experience' and (
    not (p_content ? 'text')
    or jsonb_typeof(p_content -> 'text') <> 'string'
    or nullif(btrim(p_content ->> 'text'), '') is null
  ) then
    raise exception 'Experience content requires non-empty text' using errcode = '22023';
  elsif p_kind in ('skill', 'certification', 'interest') and (
    not (p_content ? 'name')
    or jsonb_typeof(p_content -> 'name') <> 'string'
    or nullif(btrim(p_content ->> 'name'), '') is null
  ) then
    raise exception '% content requires a non-empty name', p_kind using errcode = '22023';
  elsif p_kind = 'education' and (
    not (p_content ? 'institution')
    or jsonb_typeof(p_content -> 'institution') <> 'string'
    or nullif(btrim(p_content ->> 'institution'), '') is null
  ) then
    raise exception 'Education content requires a non-empty institution' using errcode = '22023';
  end if;

  if p_kind = 'experience' and exists (
    select 1 from jsonb_each(p_content) field
    where field.key in ('name', 'position', 'url', 'startDate', 'endDate', 'summary')
      and jsonb_typeof(field.value) <> 'string'
  ) then raise exception 'Experience optional fields must be strings' using errcode = '22023'; end if;
  if p_kind = 'skill' and exists (
    select 1 from jsonb_each(p_content) field
    where field.key = 'level' and jsonb_typeof(field.value) <> 'string'
  ) then raise exception 'Skill level must be a string' using errcode = '22023'; end if;
  if p_kind = 'certification' and exists (
    select 1 from jsonb_each(p_content) field
    where field.key in ('issuer', 'date', 'url') and jsonb_typeof(field.value) <> 'string'
  ) then raise exception 'Certification optional fields must be strings' using errcode = '22023'; end if;
  if p_kind = 'education' and exists (
    select 1 from jsonb_each(p_content) field
    where field.key in ('url', 'area', 'studyType', 'startDate', 'endDate', 'score')
      and jsonb_typeof(field.value) <> 'string'
  ) then raise exception 'Education optional fields must be strings' using errcode = '22023'; end if;

  if p_kind in ('skill', 'interest') and (p_content ? 'keywords') and (
    jsonb_typeof(p_content -> 'keywords') <> 'array'
    or exists (select 1 from jsonb_array_elements(p_content -> 'keywords') item where jsonb_typeof(item) <> 'string')
  ) then raise exception 'CV Block keywords must be an array of strings' using errcode = '22023'; end if;
  if p_kind = 'experience' and (p_content ? 'highlights') and (
    jsonb_typeof(p_content -> 'highlights') <> 'array'
    or exists (select 1 from jsonb_array_elements(p_content -> 'highlights') item where jsonb_typeof(item) <> 'string')
  ) then raise exception 'Experience highlights must be an array of strings' using errcode = '22023'; end if;
  if p_kind = 'education' and (p_content ? 'courses') and (
    jsonb_typeof(p_content -> 'courses') <> 'array'
    or exists (select 1 from jsonb_array_elements(p_content -> 'courses') item where jsonb_typeof(item) <> 'string')
  ) then raise exception 'Education courses must be an array of strings' using errcode = '22023'; end if;
end;
$$;

revoke all on function public.validate_cv_block_content(text, text, jsonb)
from public, anon, authenticated;

do $$
declare
  existing_version record;
begin
  for existing_version in
    select block.kind, version.schema_version, version.content
    from public.cv_block_versions version
    join public.cv_blocks block on block.id = version.block_id
  loop
    perform public.validate_cv_block_content(
      existing_version.kind,
      existing_version.schema_version,
      existing_version.content
    );
  end loop;
end;
$$;

revoke insert, update, delete on public.cv_blocks from authenticated;
revoke insert, update, delete on public.cv_block_versions from authenticated;
revoke insert, update, delete on public.cv_block_contexts from authenticated;
grant select on public.cv_blocks, public.cv_block_versions, public.cv_block_contexts to authenticated;

drop function if exists public.save_cv_block_version(jsonb, uuid, text, text, uuid, text, jsonb, jsonb);
create function public.save_cv_block_version(
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
    if v_block.current_version_id is distinct from p_based_on_version_id then
      raise exception 'This block has changed since the selected base version' using errcode = '40001';
    end if;
    select * into base_version from public.cv_block_versions
    where id = p_based_on_version_id and owner_id = v_owner_id;
    if not found or base_version.block_id <> v_block.id then
      raise exception 'Base Block Version must belong to the same CV Block identity' using errcode = '23514';
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
revoke all on function public.save_cv_block_version(jsonb, uuid, text, text, uuid, text, jsonb, jsonb, text)
from public, anon;
grant execute on function public.save_cv_block_version(jsonb, uuid, text, text, uuid, text, jsonb, jsonb, text)
to authenticated, service_role;

create or replace function public.save_cv_block_versions(p_versions jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_saved jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_versions) <> 'array' or jsonb_array_length(p_versions) = 0 then
    raise exception 'At least one block version is required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_versions) > 20 then raise exception 'No more than 20 block versions may be saved together' using errcode = '22023'; end if;
  for v_item in select value from jsonb_array_elements(p_versions)
  loop
    v_saved := public.save_cv_block_version(
      p_content => v_item -> 'content',
      p_block_id => nullif(v_item ->> 'block_id', '')::uuid,
      p_kind => v_item ->> 'kind',
      p_title => v_item ->> 'title',
      p_based_on_version_id => nullif(v_item ->> 'based_on_version_id', '')::uuid,
      p_source_type => coalesce(v_item ->> 'source_type', 'human'),
      p_source_metadata => coalesce(v_item -> 'source_metadata', '{}'::jsonb),
      p_contexts => case when v_item ? 'contexts' then v_item -> 'contexts' else null end,
      p_schema_version => coalesce(v_item ->> 'schema_version', '1')
    );
    v_results := v_results || jsonb_build_array(v_saved);
  end loop;
  return v_results;
end;
$$;
revoke all on function public.save_cv_block_versions(jsonb) from public, anon;
grant execute on function public.save_cv_block_versions(jsonb) to authenticated, service_role;

create or replace function public.validate_cv_composition_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  block public.cv_blocks%rowtype;
  version public.cv_block_versions%rowtype;
  parent_owner_id uuid;
  parent_cv_id uuid;
begin
  select * into block from public.cv_blocks where id = new.block_id;
  select * into version from public.cv_block_versions where id = new.version_id;
  if not found or block.id is null then raise exception 'CV Block or Block Version not found' using errcode = '23503'; end if;
  if version.block_id <> new.block_id or version.owner_id <> new.owner_id or block.owner_id <> new.owner_id then
    raise exception 'Composition owner and exact Block identity must match its Block Version' using errcode = '23514';
  end if;
  if tg_table_name = 'cv_compositions' then
    select owner_id, id into parent_owner_id, parent_cv_id from public.cv_documents where id = new.cv_id;
  elsif tg_table_name = 'cv_editing_session_compositions' then
    select owner_id, cv_id into parent_owner_id, parent_cv_id from public.cv_editing_sessions where id = new.session_id;
  else
    select owner_id, cv_id into parent_owner_id, parent_cv_id from public.cv_revisions where id = new.revision_id;
  end if;
  if parent_owner_id is distinct from new.owner_id or parent_cv_id is distinct from new.cv_id then
    raise exception 'Composition parent ownership and CV lineage must match' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_cv_composition_identity() from public, anon, authenticated;

drop trigger if exists validate_cv_composition_identity on public.cv_compositions;
create trigger validate_cv_composition_identity before insert or update on public.cv_compositions
for each row execute function public.validate_cv_composition_identity();
drop trigger if exists validate_cv_editing_composition_identity on public.cv_editing_session_compositions;
create trigger validate_cv_editing_composition_identity before insert or update on public.cv_editing_session_compositions
for each row execute function public.validate_cv_composition_identity();
drop trigger if exists validate_cv_revision_composition_identity on public.cv_revision_compositions;
create trigger validate_cv_revision_composition_identity before insert or update on public.cv_revision_compositions
for each row execute function public.validate_cv_composition_identity();

create or replace function public.duplicate_cv_block(p_block_id uuid, p_title text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  source_block public.cv_blocks%rowtype;
  source_version public.cv_block_versions%rowtype;
  new_block public.cv_blocks%rowtype;
  new_version public.cv_block_versions%rowtype;
begin
  if v_owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into source_block from public.cv_blocks where id = p_block_id and owner_id = v_owner_id for share;
  if not found then raise exception 'CV Block not found' using errcode = 'P0002'; end if;
  select * into source_version from public.cv_block_versions
  where id = source_block.current_version_id and block_id = source_block.id and owner_id = v_owner_id;
  if not found then raise exception 'Current Block Version not found' using errcode = 'P0002'; end if;
  perform public.validate_cv_block_content(source_block.kind, source_version.schema_version, source_version.content);
  insert into public.cv_blocks(owner_id, kind, title, status)
  values(v_owner_id, source_block.kind, coalesce(nullif(btrim(p_title), ''), source_block.title || ' copy'), 'active')
  returning * into new_block;
  insert into public.cv_block_versions(block_id, owner_id, version_number, schema_version, content, source_type, source_metadata, based_on_version_id)
  values(new_block.id, v_owner_id, 1, source_version.schema_version, source_version.content, 'human',
    jsonb_build_object('duplicatedFromBlockId', source_block.id, 'duplicatedFromVersionId', source_version.id), null)
  returning * into new_version;
  insert into public.cv_block_contexts(block_id, owner_id, context_type, context_key, label, metadata)
  select new_block.id, v_owner_id, context_type, context_key, label, metadata
  from public.cv_block_contexts where block_id = source_block.id and owner_id = v_owner_id;
  update public.cv_blocks set current_version_id = new_version.id, updated_at = now() where id = new_block.id;
  return jsonb_build_object(
    'id', new_version.id, 'blockId', new_block.id, 'number', 1, 'schemaVersion', new_version.schema_version,
    'content', new_version.content, 'basedOnVersionId', null,
    'source', jsonb_build_object('type', 'human', 'duplicatedFromBlockId', source_block.id, 'duplicatedFromVersionId', source_version.id)
  );
end;
$$;
revoke all on function public.duplicate_cv_block(uuid, text) from public, anon;
grant execute on function public.duplicate_cv_block(uuid, text) to authenticated;

create or replace function public.set_cv_block_status(p_block_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  saved public.cv_blocks%rowtype;
begin
  if v_owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_status not in ('active', 'archived') then raise exception 'Unsupported CV Block status' using errcode = '22023'; end if;
  update public.cv_blocks set status = p_status, updated_at = now()
  where id = p_block_id and owner_id = v_owner_id returning * into saved;
  if not found then raise exception 'CV Block not found' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', saved.id, 'status', saved.status);
end;
$$;
revoke all on function public.set_cv_block_status(uuid, text) from public, anon;
grant execute on function public.set_cv_block_status(uuid, text) to authenticated;

create or replace function public.delete_cv_block(p_block_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
begin
  if v_owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.cv_blocks where id = p_block_id and owner_id = v_owner_id for update;
  if not found then raise exception 'CV Block not found' using errcode = 'P0002'; end if;
  if exists (
    select 1 from public.cv_compositions where block_id = p_block_id and owner_id = v_owner_id
    union all
    select 1 from public.cv_editing_session_compositions where block_id = p_block_id and owner_id = v_owner_id
    union all
    select 1 from public.cv_revision_compositions where block_id = p_block_id and owner_id = v_owner_id
  ) then
    raise exception 'CV Block is referenced; archive it instead' using errcode = '55000';
  end if;
  delete from public.cv_blocks where id = p_block_id and owner_id = v_owner_id;
  return jsonb_build_object('deletedBlockId', p_block_id);
end;
$$;
revoke all on function public.delete_cv_block(uuid) from public, anon;
grant execute on function public.delete_cv_block(uuid) to authenticated;

commit;
