-- Persist a reviewed set of block versions as one transaction. Any invalid item
-- aborts the function call and rolls back every block/version/context created by it.

create or replace function public.save_cv_block_versions(p_versions jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_saved jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_versions) <> 'array' or jsonb_array_length(p_versions) = 0 then
    raise exception 'At least one block version is required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_versions) > 20 then
    raise exception 'No more than 20 block versions may be saved together' using errcode = '22023';
  end if;

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
      p_contexts => case when v_item ? 'contexts' then v_item -> 'contexts' else null end
    );
    v_results := v_results || jsonb_build_array(v_saved);
  end loop;

  return v_results;
end;
$$;

revoke all on function public.save_cv_block_versions(jsonb)
from public, anon;

grant execute on function public.save_cv_block_versions(jsonb)
to authenticated, service_role;
