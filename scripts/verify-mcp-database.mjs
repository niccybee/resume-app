import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const cluster = await mkdtemp(join(tmpdir(), "resume-studio-mcp-db-"));
const port = 55432;
const connection = ["-h", cluster, "-p", String(port), "-U", "postgres", "-d", "postgres"];

function run(command, args, { input } = {}) {
  const result = Bun.spawnSync([command, ...args], {
    cwd: root,
    stdin: input ? Buffer.from(input) : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(`${command} failed:\n${result.stderr.toString() || result.stdout.toString()}`);
  }
  return result.stdout.toString();
}

const fixture = String.raw`
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create role anon;
create role authenticated;
create role service_role bypassrls;
create role authenticator noinherit;

create table auth.users(id uuid primary key);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create table public.cv_documents(
  id uuid primary key,
  published_revision_id uuid
);
create table public.cv_revisions(
  id uuid primary key,
  cv_id uuid not null,
  base_revision_id uuid
);
create table public.cv_revision_compositions(
  id uuid primary key,
  revision_id uuid not null,
  cv_id uuid not null
);
create table public.cv_editing_sessions(
  id uuid primary key,
  cv_id uuid not null,
  base_revision_id uuid,
  finished_revision_id uuid
);
create table public.cv_editing_session_compositions(
  id uuid primary key,
  session_id uuid not null,
  cv_id uuid not null
);

create table public.cv_blocks(
  id uuid primary key,
  owner_id uuid not null,
  kind text not null,
  title text not null,
  status text not null,
  current_version_id uuid,
  updated_at timestamptz not null default now()
);
create table public.cv_block_versions(
  id uuid primary key,
  block_id uuid not null references public.cv_blocks(id),
  content jsonb not null default '{}'
);
alter table public.cv_blocks add constraint cv_blocks_current_version_fk
  foreign key(current_version_id) references public.cv_block_versions(id);
create table public.cv_block_contexts(
  id uuid primary key,
  block_id uuid not null references public.cv_blocks(id),
  context_key text,
  label text,
  metadata jsonb not null default '{}'
);
create table public.cv_change_proposals(
  id uuid primary key,
  operation_type text not null,
  target_type text not null,
  target_id uuid not null,
  target_cv_id uuid,
  status text not null
);
`;

const assertions = String.raw`
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001');
insert into public.cv_mcp_gateway_config(singleton, gateway_key_sha256)
values (true, encode(extensions.digest('database-integration-gateway-key-123456', 'sha256'), 'hex'));

set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set request.headers = '{}';
select private.check_resume_studio_request();

set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"00000000-0000-4000-8000-000000000010"}';
set request.headers = '{}';
do $$
begin
  begin
    perform private.check_resume_studio_request();
    raise exception 'OAuth request unexpectedly bypassed the MCP gateway';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

set request.headers = '{"x-resume-studio-mcp-gateway":"database-integration-gateway-key-123456"}';
select private.check_resume_studio_request();
insert into public.cv_change_proposals(
  id, operation_type, target_type, target_id, target_cv_id, status
) values (
  '00000000-0000-4000-8000-000000000020', 'edit_content', 'editing_session',
  '00000000-0000-4000-8000-000000000030', '00000000-0000-4000-8000-000000000040', 'pending'
);
do $$
begin
  if (select count(*) from public.cv_mcp_audit_events
      where operation = 'propose_content_changes' and result = 'succeeded') <> 1 then
    raise exception 'Mutation and audit did not commit together';
  end if;
end
$$;

set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}';
do $$
begin
  begin
    insert into public.cv_change_proposals(
      id, operation_type, target_type, target_id, target_cv_id, status
    ) values (
      '00000000-0000-4000-8000-000000000021', 'edit_content', 'editing_session',
      '00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000040', 'pending'
    );
    raise exception 'Audit constraint unexpectedly allowed the mutation';
  exception when check_violation then
    null;
  end;
  if exists (select 1 from public.cv_change_proposals
             where id = '00000000-0000-4000-8000-000000000021') then
    raise exception 'Mutation committed without its transactional audit';
  end if;
end
$$;
`;

let started = false;
try {
  run("initdb", ["-D", cluster, "--auth=trust", "--username=postgres", "--no-instructions"]);
  run("pg_ctl", ["-D", cluster, "-o", `-F -p ${port} -c listen_addresses='' -c unix_socket_directories='${cluster}'`, "-w", "start"]);
  started = true;
  run("psql", [...connection, "-v", "ON_ERROR_STOP=1"], { input: fixture });
  run("psql", [...connection, "-v", "ON_ERROR_STOP=1", "-f", resolve(root, "database/cv_mcp_release_hardening.sql")]);
  run("psql", [...connection, "-v", "ON_ERROR_STOP=1", "-f", resolve(root, "database/cv_mcp_advisor_hardening.sql")]);
  run("psql", [...connection, "-v", "ON_ERROR_STOP=1"], { input: assertions });
  console.log(JSON.stringify({ verified: true, cases: [
    "browser-jwt-pass", "oauth-direct-deny", "gateway-oauth-pass",
    "mutation-audit-commit", "audit-failure-rolls-back-mutation",
  ] }));
} finally {
  if (started) run("pg_ctl", ["-D", cluster, "-m", "fast", "-w", "stop"]);
  await rm(cluster, { recursive: true, force: true });
}
