-- Enforce one exact Block Version per CV Block in every CV Composition.
--
-- This migration is deliberately non-destructive. If legacy duplicates exist,
-- decide whether to remove one selection or duplicate the CV Block into a new
-- independent identity, then rerun the migration.

do $$
declare
  duplicate_groups integer;
begin
  select count(*)
  into duplicate_groups
  from (
    select composition.cv_id, composition.block_id
    from public.cv_compositions as composition
    group by composition.cv_id, composition.block_id
    having count(*) > 1
  ) as duplicates;

  if duplicate_groups > 0 then
    raise exception
      'Cannot enforce one Block Version per CV Block: % duplicate CV Composition group(s) require explicit cleanup.',
      duplicate_groups
      using errcode = '23514',
        hint = 'Remove the unintended selection, or duplicate the CV Block when both entries need independent identities.';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cv_compositions'::regclass
      and conname = 'cv_compositions_cv_id_block_id_key'
  ) then
    alter table public.cv_compositions
      add constraint cv_compositions_cv_id_block_id_key
      unique (cv_id, block_id);
  end if;
end;
$$;
