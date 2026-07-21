import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("durable Editing Sessions migration", () => {
  it("stores mutable session state and an exact Working Composition", async () => {
    const migration = await readFile(
      new URL("database/cv_editing_sessions.sql", root),
      "utf8",
    );

    expect(migration).toMatch(/^begin;/i);
    expect(migration).toMatch(/create table if not exists public\.cv_editing_sessions/i);
    expect(migration).toMatch(/base_revision_id uuid not null/i);
    expect(migration).toMatch(/optimistic_version integer not null default 1/i);
    expect(migration).toMatch(/status text not null default 'open'/i);
    expect(migration).toMatch(/create table if not exists public\.cv_editing_session_compositions/i);
    expect(migration).toMatch(/unique\s*\(session_id,\s*block_id\)/i);
    expect(migration).toMatch(/unique\s*\(session_id,\s*section,\s*position\)/i);
    expect(migration.trim()).toMatch(/commit;$/i);
  });

  it("starts from the selected or latest Revision and copies its exact snapshot", async () => {
    const migration = await readFile(
      new URL("database/cv_editing_sessions.sql", root),
      "utf8",
    );

    expect(migration).toMatch(/create or replace function public\.start_cv_editing_session/i);
    expect(migration).toMatch(/coalesce\(p_base_revision_id,\s*\([\s\S]*order by revision\.revision_number desc/i);
    expect(migration).toMatch(/insert into public\.cv_editing_sessions[\s\S]*base_revision_id/i);
    expect(migration).toMatch(/insert into public\.cv_editing_session_compositions[\s\S]*from public\.cv_revision_compositions/i);
  });

  it("creates v1 from a new legacy draft before starting its first session", async () => {
    const migration = await readFile(
      new URL("database/cv_editing_sessions.sql", root),
      "utf8",
    );
    const start = migration.slice(
      migration.indexOf("create or replace function public.start_cv_editing_session"),
      migration.indexOf("revoke all on function public.start_cv_editing_session"),
    );

    expect(start).toMatch(/from public\.cv_documents[\s\S]*for update/i);
    expect(start).toMatch(/if v_base_revision_id is null and p_base_revision_id is null then/i);
    expect(start).toMatch(/insert into public\.cv_revisions[\s\S]*revision_number[\s\S]*1/i);
    expect(start).toMatch(/insert into public\.cv_revision_compositions[\s\S]*from public\.cv_compositions/i);
  });

  it("persists Working Composition changes behind optimistic concurrency", async () => {
    const migration = await readFile(
      new URL("database/cv_editing_sessions.sql", root),
      "utf8",
    );

    expect(migration).toMatch(/create or replace function public\.save_cv_editing_session/i);
    expect(migration).toMatch(/optimistic_version = p_expected_version/i);
    expect(migration).toMatch(/p_expected_version is null/i);
    expect(migration).toMatch(/optimistic_version is distinct from p_expected_version/i);
    expect(migration).toMatch(/optimistic_version = optimistic_version \+ 1/i);
    expect(migration).toMatch(/get diagnostics v_updated_count = row_count/i);
    expect(migration).toMatch(/delete from public\.cv_editing_session_compositions/i);
    expect(migration).toMatch(/insert into public\.cv_editing_session_compositions/i);
    expect(migration).toMatch(/session-conflict/i);
  });

  it("finishes atomically and idempotently in CV completion order", async () => {
    const migration = await readFile(
      new URL("database/cv_editing_sessions.sql", root),
      "utf8",
    );
    const finishStart = migration.indexOf("create or replace function public.finish_cv_editing_session");
    const finishEnd = migration.indexOf("revoke all on function public.finish_cv_editing_session");
    const finish = migration.slice(finishStart, finishEnd);

    expect(finish).toMatch(/from public\.cv_editing_sessions[\s\S]*for update/i);
    expect(finish).toMatch(/p_expected_version is null/i);
    expect(finish).toMatch(/optimistic_version is distinct from p_expected_version/i);
    expect(finish).toMatch(/if editing_session\.status = 'finished'[\s\S]*return editing_session\.finished_revision_id/i);
    expect(finish).toMatch(/from public\.cv_documents[\s\S]*for update/i);
    expect(finish).toMatch(/coalesce\(max\(revision\.revision_number\), 0\) \+ 1/i);
    expect(finish).toMatch(/insert into public\.cv_revisions/i);
    expect(finish).toMatch(/base_revision_id[\s\S]*editing_session\.base_revision_id/i);
    expect(finish).toMatch(/insert into public\.cv_revision_compositions[\s\S]*from public\.cv_editing_session_compositions/i);
    expect(finish).toMatch(/status = 'finished'[\s\S]*finished_revision_id = v_revision_id/i);
    expect(finish).not.toMatch(/published_revision_id/i);
    expect(finish).not.toMatch(/update public\.cv_documents/i);
  });

  it("reads session metadata and Working Composition from one database snapshot", async () => {
    const migration = await readFile(
      new URL("database/cv_editing_sessions.sql", root),
      "utf8",
    );
    const getter = migration.slice(
      migration.indexOf("create or replace function public.get_cv_editing_session"),
      migration.indexOf("revoke all on function public.get_cv_editing_session"),
    );

    expect(migration).toMatch(/create or replace function public\.get_cv_editing_session/i);
    expect(getter).toMatch(/from public\.cv_editing_sessions as editing_session/i);
    expect(getter).toMatch(/from public\.cv_editing_session_compositions as composition/i);
    expect(getter).toMatch(/join public\.cv_block_versions as version/i);
    expect(migration).toMatch(/revoke all on function public\.get_cv_editing_session\(uuid\)[\s\S]*from public, anon/i);
    expect(migration).toMatch(/grant execute on function public\.get_cv_editing_session\(uuid\)[\s\S]*to authenticated/i);
  });

  it("exposes only authenticated owner-scoped RPC and read boundaries", async () => {
    const migration = await readFile(
      new URL("database/cv_editing_sessions.sql", root),
      "utf8",
    );

    expect(migration).toMatch(/security definer[\s\S]*set search_path = ''/i);
    expect(migration).toMatch(/auth\.uid\(\)/i);
    expect(migration).toMatch(/revoke all on public\.cv_editing_sessions from public, anon, authenticated/i);
    expect(migration).toMatch(/grant select on public\.cv_editing_sessions to authenticated/i);
    expect(migration).toMatch(/revoke all on function public\.start_cv_editing_session[\s\S]*from public, anon/i);
    expect(migration).toMatch(/grant execute on function public\.finish_cv_editing_session[\s\S]*to authenticated/i);
  });
});
