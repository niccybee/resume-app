import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("MCP database advisor hardening", () => {
  async function migration() {
    return readFile(
      new URL("database/cv_mcp_advisor_hardening.sql", root),
      "utf8",
    );
  }

  it("moves the PostgREST request hook out of the exposed public schema", async () => {
    const sql = await migration();
    expect(sql).toMatch(/^begin;/i);
    expect(sql).toMatch(/create or replace function private\.check_resume_studio_request\(\)/i);
    expect(sql).toMatch(/security definer[\s\S]*set search_path = ''/i);
    expect(sql).toMatch(/revoke all on function private\.check_resume_studio_request\(\) from public/i);
    expect(sql).toMatch(/grant execute on function private\.check_resume_studio_request\(\)[\s\S]*to anon, authenticated, service_role, authenticator/i);
    expect(sql).toMatch(/alter role authenticator\s+set pgrst\.db_pre_request = 'private\.check_resume_studio_request'/i);
    expect(sql).toMatch(/drop function if exists public\.check_resume_studio_request\(\)/i);
    expect(sql.trim()).toMatch(/commit;$/i);
  });

  it("adds covering indexes for the new composite foreign keys", async () => {
    const sql = await migration();
    expect(sql).toMatch(/on public\.cv_documents\(published_revision_id, id\)/i);
    expect(sql).toMatch(/on public\.cv_revisions\(base_revision_id, cv_id\)/i);
    expect(sql).toMatch(/on public\.cv_revision_compositions\(revision_id, cv_id\)/i);
    expect(sql).toMatch(/on public\.cv_editing_sessions\(base_revision_id, cv_id\)/i);
    expect(sql).toMatch(/on public\.cv_editing_sessions\(finished_revision_id, cv_id\)/i);
    expect(sql).toMatch(/on public\.cv_editing_session_compositions\(session_id, cv_id\)/i);
  });
});
