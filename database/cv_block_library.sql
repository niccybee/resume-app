create table public.cv_blocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in ('experience', 'skill', 'certification', 'education', 'interest')
  ),
  title text not null check (btrim(title) <> ''),
  status text not null default 'active' check (status in ('active', 'archived')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cv_block_versions (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.cv_blocks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  source_type text not null default 'human' check (
    source_type in ('human', 'ai', 'import')
  ),
  source_metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(source_metadata) = 'object'
  ),
  based_on_version_id uuid references public.cv_block_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (block_id, version_number)
);

alter table public.cv_blocks
  add constraint cv_blocks_current_version_id_fkey
  foreign key (current_version_id)
  references public.cv_block_versions(id)
  on delete set null;

create table public.cv_block_contexts (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.cv_blocks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  context_type text not null check (
    context_type in ('employment', 'sidebar', 'profile')
  ),
  context_key text not null check (btrim(context_key) <> ''),
  label text,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default now(),
  unique (block_id, context_type, context_key)
);

create table public.cv_generation_runs (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.cv_blocks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  based_on_version_id uuid not null references public.cv_block_versions(id),
  accepted_version_id uuid references public.cv_block_versions(id),
  instruction text not null check (btrim(instruction) <> ''),
  provider text,
  status text not null default 'draft' check (
    status in ('draft', 'accepted', 'rejected', 'failed')
  ),
  output_content jsonb check (
    output_content is null or jsonb_typeof(output_content) = 'object'
  ),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cv_blocks_owner_id_idx on public.cv_blocks(owner_id);
create index cv_blocks_owner_kind_idx on public.cv_blocks(owner_id, kind);
create index cv_blocks_current_version_id_idx on public.cv_blocks(current_version_id);
create index cv_block_versions_owner_id_idx on public.cv_block_versions(owner_id);
create index cv_block_versions_block_id_idx on public.cv_block_versions(block_id);
create index cv_block_versions_based_on_version_id_idx
  on public.cv_block_versions(based_on_version_id);
create index cv_block_contexts_owner_id_idx on public.cv_block_contexts(owner_id);
create index cv_block_contexts_block_id_idx on public.cv_block_contexts(block_id);
create index cv_generation_runs_owner_id_idx on public.cv_generation_runs(owner_id);
create index cv_generation_runs_block_id_idx on public.cv_generation_runs(block_id);
create index cv_generation_runs_based_on_version_id_idx
  on public.cv_generation_runs(based_on_version_id);
create index cv_generation_runs_accepted_version_id_idx
  on public.cv_generation_runs(accepted_version_id);

alter table public.cv_blocks enable row level security;
alter table public.cv_block_versions enable row level security;
alter table public.cv_block_contexts enable row level security;
alter table public.cv_generation_runs enable row level security;

create policy "Owners manage their CV blocks"
on public.cv_blocks
for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "Owners read their CV block versions"
on public.cv_block_versions
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "Owners append CV block versions"
on public.cv_block_versions
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "Owners manage their CV block contexts"
on public.cv_block_contexts
for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "Owners manage their CV generation runs"
on public.cv_generation_runs
for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

grant select, insert, update, delete on public.cv_blocks to authenticated;
grant select, insert on public.cv_block_versions to authenticated;
grant select, insert, update, delete on public.cv_block_contexts to authenticated;
grant select, insert, update, delete on public.cv_generation_runs to authenticated;

revoke all on public.cv_blocks from anon;
revoke all on public.cv_block_versions from anon;
revoke all on public.cv_block_contexts from anon;
revoke all on public.cv_generation_runs from anon;

create or replace function public.save_cv_block_version(
  p_content jsonb,
  p_block_id uuid default null,
  p_kind text default null,
  p_title text default null,
  p_based_on_version_id uuid default null,
  p_source_type text default 'human',
  p_source_metadata jsonb default '{}'::jsonb,
  p_contexts jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_block public.cv_blocks%rowtype;
  v_version public.cv_block_versions%rowtype;
  v_version_number integer;
  v_context jsonb;
begin
  if v_owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'Block content must be a JSON object' using errcode = '22023';
  end if;

  if p_block_id is null then
    if p_kind is null or p_kind not in (
      'experience', 'skill', 'certification', 'education', 'interest'
    ) then
      raise exception 'A supported block kind is required' using errcode = '22023';
    end if;
    if p_title is null or btrim(p_title) = '' then
      raise exception 'A block title is required' using errcode = '22023';
    end if;

    insert into public.cv_blocks (owner_id, kind, title)
    values (v_owner_id, p_kind, btrim(p_title))
    returning * into v_block;
  else
    select * into v_block
    from public.cv_blocks
    where id = p_block_id and owner_id = v_owner_id
    for update;

    if not found then
      raise exception 'Block not found' using errcode = 'P0002';
    end if;

    if v_block.current_version_id is distinct from p_based_on_version_id then
      raise exception 'This block has changed since the selected base version'
        using errcode = '40001';
    end if;
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_version_number
  from public.cv_block_versions
  where block_id = v_block.id;

  insert into public.cv_block_versions (
    block_id,
    owner_id,
    version_number,
    content,
    source_type,
    source_metadata,
    based_on_version_id
  )
  values (
    v_block.id,
    v_owner_id,
    v_version_number,
    p_content,
    p_source_type,
    coalesce(p_source_metadata, '{}'::jsonb),
    p_based_on_version_id
  )
  returning * into v_version;

  update public.cv_blocks
  set current_version_id = v_version.id, updated_at = now()
  where id = v_block.id;

  if p_contexts is not null then
    if jsonb_typeof(p_contexts) <> 'array' then
      raise exception 'Block contexts must be a JSON array' using errcode = '22023';
    end if;

    delete from public.cv_block_contexts
    where block_id = v_block.id and owner_id = v_owner_id;

    for v_context in select * from jsonb_array_elements(p_contexts)
    loop
      insert into public.cv_block_contexts (
        block_id,
        owner_id,
        context_type,
        context_key,
        label,
        metadata
      )
      values (
        v_block.id,
        v_owner_id,
        v_context ->> 'type',
        v_context ->> 'key',
        v_context ->> 'label',
        coalesce(v_context -> 'metadata', '{}'::jsonb)
      );
    end loop;
  end if;

  return jsonb_build_object(
    'id', v_version.id,
    'blockId', v_version.block_id,
    'number', v_version.version_number,
    'content', v_version.content,
    'source', jsonb_build_object('type', v_version.source_type) || v_version.source_metadata,
    'basedOnVersionId', v_version.based_on_version_id,
    'createdAt', v_version.created_at
  );
end;
$$;

revoke all on function public.save_cv_block_version(
  jsonb, uuid, text, text, uuid, text, jsonb, jsonb
) from public, anon;
grant execute on function public.save_cv_block_version(
  jsonb, uuid, text, text, uuid, text, jsonb, jsonb
) to authenticated;

create or replace function public.mark_cv_generation_run_accepted()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.source_type = 'ai' and new.source_metadata ? 'runId' then
    update public.cv_generation_runs
    set
      status = 'accepted',
      accepted_version_id = new.id,
      updated_at = now()
    where id = (new.source_metadata ->> 'runId')::uuid
      and owner_id = new.owner_id
      and block_id = new.block_id;
  end if;
  return new;
end;
$$;

revoke all on function public.mark_cv_generation_run_accepted()
from public, anon, authenticated;

create trigger mark_cv_generation_run_accepted
after insert on public.cv_block_versions
for each row
execute function public.mark_cv_generation_run_accepted();
