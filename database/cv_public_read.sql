-- Curated, unlisted public CV reads.
-- Apply after cv_documents.sql and cv_block_library.sql.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.get_published_cv(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', document.id,
    'name', document.name,
    'slug', document.slug,
    'status', document.status,
    'themeId', document.theme_id,
    'profile', jsonb_build_object(
      'basics', jsonb_strip_nulls(jsonb_build_object(
        'name', document.profile #>> '{basics,name}',
        'label', document.profile #>> '{basics,label}',
        'email', document.profile #>> '{basics,email}',
        'phone', document.profile #>> '{basics,phone}',
        'url', document.profile #>> '{basics,url}',
        'summary', document.profile #>> '{basics,summary}'
      ))
    ),
    'summary', document.summary,
    'publishedAt', document.published_at,
    'selections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'blockId', composition.block_id,
          'versionId', composition.version_id,
          'section', composition.section,
          'order', composition.position,
          'content', version.content,
          'group', jsonb_strip_nulls(jsonb_build_object(
            'employerId', composition.display #>> '{grouping,employerId}',
            'employer', composition.display #>> '{grouping,employer}',
            'roleId', composition.display #>> '{grouping,roleId}',
            'role', composition.display #>> '{grouping,role}',
            'occasionId', composition.display #>> '{grouping,occasionId}',
            'startDate', composition.display #>> '{grouping,startDate}',
            'endDate', composition.display #>> '{grouping,endDate}'
          )),
          'block', jsonb_strip_nulls(jsonb_build_object(
            'title', composition.display ->> 'title',
            'kind', composition.display ->> 'kind',
            'versionNumber', composition.display -> 'versionNumber',
            'contexts', coalesce((
              select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'type', context ->> 'type',
                'label', context ->> 'label'
              )))
              from jsonb_array_elements(
                case
                  when jsonb_typeof(composition.display -> 'contexts') = 'array'
                    then composition.display -> 'contexts'
                  else '[]'::jsonb
                end
              ) as context
            ), '[]'::jsonb)
          ))
        )
        order by composition.section, composition.position
      )
      from public.cv_compositions as composition
      join public.cv_block_versions as version
        on version.id = composition.version_id
      where composition.cv_id = document.id
    ), '[]'::jsonb)
  )
  from public.cv_documents as document
  where document.slug = p_slug
    and document.status = 'published'
  limit 1;
$$;

revoke all on function private.get_published_cv(text) from public;
grant execute on function private.get_published_cv(text)
  to anon, authenticated, service_role;

create or replace function public.get_published_cv(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_published_cv(p_slug);
$$;

revoke all on function public.get_published_cv(text) from public;
grant execute on function public.get_published_cv(text)
  to anon, authenticated, service_role;

revoke all on table public.cv_documents from anon;
revoke all on table public.cv_compositions from anon;
revoke all on table public.cv_blocks from anon;
revoke all on table public.cv_block_versions from anon;
revoke all on table public.cv_block_contexts from anon;
