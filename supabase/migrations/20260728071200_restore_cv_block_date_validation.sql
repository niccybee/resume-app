begin;

-- Restore the date validator required by lifecycle proposals on installations
-- where the legacy CV Block migration was applied outside Supabase history.
create or replace function public.is_valid_cv_block_date(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_parts text[];
  v_year integer;
  v_month integer;
  v_day integer;
  v_max_day integer;
  v_leap boolean;
begin
  if p_value is null or p_value !~ '^[0-9]{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12][0-9]|3[01]))?)?$' then
    return false;
  end if;
  v_parts := string_to_array(p_value, '-');
  if array_length(v_parts, 1) < 3 then return true; end if;
  v_year := v_parts[1]::integer;
  v_month := v_parts[2]::integer;
  v_day := v_parts[3]::integer;
  v_leap := mod(v_year, 4) = 0 and (mod(v_year, 100) <> 0 or mod(v_year, 400) = 0);
  v_max_day := case
    when v_month in (1, 3, 5, 7, 8, 10, 12) then 31
    when v_month in (4, 6, 9, 11) then 30
    when v_leap then 29
    else 28
  end;
  return v_day <= v_max_day;
end;
$$;

revoke all on function public.is_valid_cv_block_date(text)
  from public, anon, authenticated;

commit;
