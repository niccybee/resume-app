begin;

create or replace function public.get_cv_revision_snapshot(
  p_cv_id uuid,
  p_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_revision jsonb;
  v_selections jsonb;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', revision.id,
    'cvId', revision.cv_id,
    'number', revision.revision_number,
    'baseRevisionId', revision.base_revision_id,
    'themeId', revision.theme_id,
    'profile', revision.profile,
    'summary', revision.summary,
    'summaryProvenance', revision.summary_provenance,
    'createdAt', revision.created_at
  )
  into v_revision
  from public.cv_revisions as revision
  where revision.id = p_revision_id
    and revision.cv_id = p_cv_id
    and revision.owner_id = v_owner_id;

  if v_revision is null then
    raise exception 'CV Revision not found.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(selection.value order by selection.section, selection.position), '[]'::jsonb)
  into v_selections
  from (
    select
      composition.section,
      composition.position,
      jsonb_strip_nulls(jsonb_build_object(
        'blockId', composition.block_id,
        'versionId', composition.version_id,
        'section', composition.section,
        'order', composition.position,
        'content', version.content,
        'block', coalesce(composition.display, '{}'::jsonb) || jsonb_build_object(
          'title', block.title,
          'kind', block.kind,
          'versionNumber', version.version_number,
          'schemaVersion', version.schema_version
        ),
        'group', composition.display -> 'grouping'
      )) as value
    from public.cv_revision_compositions as composition
    join public.cv_block_versions as version
      on version.id = composition.version_id
      and version.block_id = composition.block_id
      and version.owner_id = v_owner_id
    join public.cv_blocks as block
      on block.id = composition.block_id
      and block.owner_id = v_owner_id
    where composition.revision_id = p_revision_id
      and composition.cv_id = p_cv_id
      and composition.owner_id = v_owner_id
    order by composition.section, composition.position
  ) as selection;

  return v_revision || jsonb_build_object('selections', v_selections);
end;
$$;

revoke all on function public.get_cv_revision_snapshot(uuid, uuid)
from public, anon;
grant execute on function public.get_cv_revision_snapshot(uuid, uuid)
to authenticated;

commit;
