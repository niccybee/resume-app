import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("external MCP release verification", () => {
  it("uses the standards client, requires explicit apply consent, and reconnects to verify persistence", async () => {
    const source = await readFile(new URL("scripts/verify-mcp-release.mjs", root), "utf8");
    expect(source).toMatch(/@modelcontextprotocol\/sdk\/client/);
    expect(source).toMatch(/RESUME_STUDIO_MCP_CONFIRM_APPLY/);
    expect(source).toMatch(/RESUME_STUDIO_MCP_CONFIRM_REVOKE/);
    expect(source).toMatch(/revoked OAuth grant still connected/i);
    expect(source).toMatch(/finally[\s\S]*if \(!grantRevoked\) await revokeVerificationGrant\(\)/);
    expect(source).toMatch(/copy_to_new_version/);
    expect(source.match(/new Client/g)).toHaveLength(3);
    expect(source).toMatch(/list_editing_sessions/);
    expect(source).toMatch(/Copy to New Version changed or closed the source Editing Session/);
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:ACCESS_TOKEN|accessToken)/);
  });

  it("ships an executable disposable Postgres verification for gateway and audit atomicity", async () => {
    const source = await readFile(new URL("scripts/verify-mcp-database.mjs", root), "utf8");
    expect(source).toMatch(/browser-jwt-pass/);
    expect(source).toMatch(/oauth-direct-deny/);
    expect(source).toMatch(/gateway-oauth-pass/);
    expect(source).toMatch(/audit-failure-rolls-back-mutation/);
    expect(source).toMatch(/database\/cv_mcp_release_hardening\.sql/);
  });
});
