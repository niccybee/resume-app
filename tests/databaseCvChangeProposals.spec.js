import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("Change Proposal migration", () => {
  async function migration() {
    return readFile(new URL("database/cv_change_proposals.sql", root), "utf8");
  }

  it("stores immutable owner-scoped proposal contracts and lifecycle results", async () => {
    const sql = await migration();
    expect(sql).toMatch(/^begin;/i);
    expect(sql).toMatch(/create table if not exists public\.cv_change_proposals/i);
    expect(sql).toMatch(/schema_version text not null/i);
    expect(sql).toMatch(/normalized_operations jsonb not null/i);
    expect(sql).toMatch(/structured_diff jsonb not null/i);
    expect(sql).toMatch(/base_optimistic_version integer not null/i);
    expect(sql).toMatch(/status text not null default 'pending'/i);
    expect(sql).toMatch(/expires_at timestamptz not null/i);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/jsonb_typeof\(v_selection->'order'\) <> 'number'/i);
    expect(sql).toMatch(/'order', \(selection->>'order'\)::integer/i);
    expect(sql).toMatch(/create index if not exists cv_change_proposals_target_idx[\s\S]*\(target_id\)/i);
    expect(sql).toMatch(/create index if not exists cv_change_proposals_target_cv_idx[\s\S]*\(target_cv_id\)/i);
    expect(sql.trim()).toMatch(/commit;$/i);
  });

  it("creates a proposal without updating its target", async () => {
    const sql = await migration();
    const create = sql.slice(sql.indexOf("create or replace function public.create_cv_change_proposal"), sql.indexOf("revoke all on function public.create_cv_change_proposal"));
    expect(create).toMatch(/from public\.cv_editing_sessions[\s\S]*for share/i);
    expect(create).toMatch(/optimistic_version is distinct from p_base_optimistic_version/i);
    expect(create).toMatch(/insert into public\.cv_change_proposals/i);
    expect(create).toMatch(/validate_cv_proposed_working_state/i);
    expect(create).not.toMatch(/update public\.cv_editing_sessions/i);
    expect(create).not.toMatch(/delete from public\.cv_editing_session_compositions/i);
  });

  it("applies once atomically after ownership, expiry, and optimistic-version revalidation", async () => {
    const sql = await migration();
    const apply = sql.slice(sql.indexOf("create or replace function public.apply_cv_change_proposal"), sql.indexOf("revoke all on function public.apply_cv_change_proposal"));
    expect(apply).toMatch(/from public\.cv_change_proposals[\s\S]*for update/i);
    expect(apply).toMatch(/if change_proposal\.status = 'applied'[\s\S]*return/i);
    expect(apply).toMatch(/expires_at < now\(\)/i);
    expect(apply).toMatch(/from public\.cv_editing_sessions[\s\S]*for update/i);
    expect(apply).toMatch(/optimistic_version is distinct from change_proposal\.base_optimistic_version/i);
    expect(apply).toMatch(/status = 'invalidated'/i);
    expect(apply).toMatch(/get_cv_editing_session\(editing_session\.id\)/i);
    expect(apply).toMatch(/validate_cv_proposed_working_state/i);
    expect(apply).toMatch(/delete from public\.cv_editing_session_compositions/i);
    expect(apply).toMatch(/insert into public\.cv_editing_session_compositions/i);
    expect(apply).toMatch(/jsonb_build_object\('grouping', selection->'group'\)/i);
    expect(apply).toMatch(/optimistic_version = optimistic_version \+ 1/i);
    expect(apply).toMatch(/status = 'applied'/i);
  });

  it("discards without changing the Editing Session and exposes authenticated RPCs only", async () => {
    const sql = await migration();
    const discard = sql.slice(sql.indexOf("create or replace function public.discard_cv_change_proposal"), sql.indexOf("revoke all on function public.discard_cv_change_proposal"));
    expect(discard).toMatch(/status = 'discarded'/i);
    expect(discard).not.toMatch(/update public\.cv_editing_sessions/i);
    expect(sql).toMatch(/revoke all on public\.cv_change_proposals from public, anon, authenticated/i);
    expect(sql).toMatch(/grant select on public\.cv_change_proposals to authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.apply_cv_change_proposal\(uuid\)[\s\S]*from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.apply_cv_change_proposal\(uuid\)[\s\S]*to authenticated/i);
  });
});
