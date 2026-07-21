-- Server-only build manifest for static public CV generation. Unlisted slugs are
-- never enumerable by anon or authenticated browser clients.

create or replace function public.list_published_cv_slugs_for_build()
returns table (slug text)
language sql
stable
security invoker
set search_path = ''
as $$
  select document.slug
  from public.cv_documents as document
  where document.status = 'published'
    and document.slug is not null
  order by document.slug;
$$;

revoke all on function public.list_published_cv_slugs_for_build()
from public, anon, authenticated;

grant execute on function public.list_published_cv_slugs_for_build()
to service_role;
