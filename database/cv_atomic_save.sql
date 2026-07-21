-- Save a CV document and its exact ordered composition in one transaction.
-- PostgreSQL functions execute atomically: any validation or insert failure rolls
-- back both the document update and every composition change.

create or replace function public.save_cv_document(
  p_cv_id uuid,
  p_name text,
  p_theme_id text,
  p_profile jsonb,
  p_summary text,
  p_summary_provenance jsonb,
  p_selections jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_cv_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'A CV name is required.' using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_profile, '{}'::jsonb)) <> 'object' then
    raise exception 'CV profile must be an object.' using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_selections, '[]'::jsonb)) <> 'array' then
    raise exception 'CV selections must be an array.' using errcode = '23514';
  end if;

  if p_cv_id is null then
    insert into public.cv_documents (
      owner_id,
      name,
      theme_id,
      profile,
      summary,
      summary_provenance
    )
    values (
      v_owner_id,
      btrim(p_name),
      p_theme_id,
      coalesce(p_profile, '{}'::jsonb),
      nullif(p_summary, ''),
      p_summary_provenance
    )
    returning id into v_cv_id;
  else
    update public.cv_documents
    set
      name = btrim(p_name),
      theme_id = p_theme_id,
      profile = coalesce(p_profile, '{}'::jsonb),
      summary = nullif(p_summary, ''),
      summary_provenance = p_summary_provenance
    where id = p_cv_id
      and owner_id = v_owner_id
    returning id into v_cv_id;

    if v_cv_id is null then
      raise exception 'CV not found.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.cv_compositions
  where cv_id = v_cv_id
    and owner_id = v_owner_id;

  insert into public.cv_compositions (
    cv_id,
    owner_id,
    block_id,
    version_id,
    section,
    position,
    display
  )
  select
    v_cv_id,
    v_owner_id,
    selection.block_id,
    selection.version_id,
    selection.section,
    selection.position,
    coalesce(selection.display, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_selections, '[]'::jsonb)) as selection(
    block_id uuid,
    version_id uuid,
    section text,
    position integer,
    display jsonb
  );

  return v_cv_id;
end;
$$;

revoke all on function public.save_cv_document(
  uuid, text, text, jsonb, text, jsonb, jsonb
) from public, anon;

grant execute on function public.save_cv_document(
  uuid, text, text, jsonb, text, jsonb, jsonb
) to authenticated, service_role;
