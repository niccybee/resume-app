import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("MCP release hardening database contract", () => {
  async function migration() {
    return readFile(new URL("database/cv_mcp_release_hardening.sql", root), "utf8");
  }

  it("stores privacy-safe audit identities, result, and time", async () => {
    const sql = await migration();
    expect(sql).toMatch(/^begin;/i);
    expect(sql).toMatch(/create table if not exists public\.cv_mcp_audit_events/i);
    expect(sql).toMatch(/actor_id uuid not null/i);
    expect(sql).toMatch(/client_id text not null/i);
    expect(sql).toMatch(/operation text not null/i);
    expect(sql).toMatch(/target_identities jsonb not null/i);
    expect(sql).toMatch(/result text not null/i);
    expect(sql).toMatch(/occurred_at timestamptz not null default now\(\)/i);
    expect(sql).not.toMatch(/access_token|refresh_token|cv_content|proposal_payload/i);
    expect(sql.trim()).toMatch(/commit;$/i);
  });

  it("blocks OAuth JWTs from bypassing the MCP gateway through the Data API", async () => {
    const sql = await migration();
    expect(sql).toMatch(/create table if not exists public\.cv_mcp_gateway_config/i);
    expect(sql).toMatch(/revoke all on public\.cv_mcp_gateway_config from public, anon, authenticated/i);
    expect(sql).toMatch(/create or replace function public\.check_resume_studio_request/i);
    expect(sql).toMatch(/auth\.jwt\(\).*client_id/i);
    expect(sql).toMatch(/x-resume-studio-mcp-gateway/i);
    expect(sql).toMatch(/extensions\.digest\(v_gateway_key, 'sha256'\)/i);
    expect(sql).toMatch(/alter role authenticator set pgrst\.db_pre_request/i);
    expect(sql).toMatch(/notify pgrst, 'reload config'/i);
  });

  it("derives the actor from auth, validates identity-only JSON, and exposes only its recorder", async () => {
    const sql = await migration();
    const recorder = sql.slice(
      sql.indexOf("create or replace function public.record_mcp_audit_event"),
      sql.indexOf("revoke all on function public.record_mcp_audit_event"),
    );
    expect(sql).toMatch(/alter table public\.cv_mcp_audit_events enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.cv_mcp_audit_events from public, anon, authenticated/i);
    expect(recorder).toMatch(/v_actor_id uuid := \(select auth\.uid\(\)\)/i);
    expect(recorder).toMatch(/auth\.jwt\(\).*client_id/i);
    expect(recorder).toMatch(/v_client_id is distinct from p_client_id/i);
    expect(recorder).toMatch(/jsonb_object_keys/i);
    for (const key of [
      "proposalIds", "cvIds", "blockIds", "versionIds", "revisionIds", "editingSessionIds",
    ]) expect(recorder).toContain(`'${key}'`);
    for (const operation of [
      "propose_create_cv", "propose_update_cv", "propose_archive_cv", "propose_restore_cv",
      "propose_create_cv_block", "propose_update_cv_block", "propose_duplicate_cv_block",
      "propose_archive_cv_block", "propose_restore_cv_block", "propose_delete_cv_block",
    ]) expect(recorder).toContain(`'${operation}'`);
    expect(sql).toMatch(/grant execute on function public\.record_mcp_audit_event\(text, text, jsonb, text, text\)\s+to authenticated/i);
  });

  it("enforces authenticated read and mutation limits in one shared atomic bucket", async () => {
    const sql = await migration();
    expect(sql).toMatch(/create table if not exists public\.cv_mcp_rate_limits/i);
    expect(sql).toMatch(/primary key \(actor_id, client_id, scope\)/i);
    expect(sql).toMatch(/alter table public\.cv_mcp_rate_limits enable row level security/i);
    const limiter = sql.slice(
      sql.indexOf("create or replace function public.enforce_mcp_rate_limit"),
      sql.indexOf("revoke all on function public.enforce_mcp_rate_limit"),
    );
    expect(limiter).toMatch(/auth\.uid\(\)/i);
    expect(limiter).toMatch(/auth\.jwt\(\).*client_id/i);
    expect(limiter).not.toMatch(/p_limit|p_window_seconds/i);
    expect(limiter).toMatch(/case p_scope[\s\S]*when 'read' then 120[\s\S]*when 'mutation' then 60/i);
    expect(limiter).toMatch(/insert into public\.cv_mcp_rate_limits[\s\S]*on conflict \(actor_id, client_id, scope\)[\s\S]*do update/i);
    expect(limiter).toMatch(/'allowed'[\s\S]*v_count <= v_limit/i);
  });

  it("searches before limiting and audits successful OAuth mutations in the same transaction", async () => {
    const sql = await migration();
    expect(sql).toMatch(/create or replace function public\.search_mcp_cv_block_ids/i);
    expect(sql).toMatch(/where b\.owner_id = v_actor_id[\s\S]*ilike[\s\S]*order by b\.updated_at desc[\s\S]*limit p_limit/i);
    expect(sql).toMatch(/create or replace function public\.audit_mcp_change_proposal_mutation/i);
    expect(sql).toMatch(/insert into public\.cv_mcp_audit_events/i);
    expect(sql).toMatch(/if new\.target_cv_id is not null then[\s\S]*'cvIds'/i);
    expect(sql).toMatch(/create trigger cv_change_proposals_mcp_audit[\s\S]*after insert or update of status/i);
  });
});
