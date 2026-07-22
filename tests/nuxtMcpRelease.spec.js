import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("Nuxt MCP release controls", () => {
  it("keeps marked secrets out of generated Nuxt build configuration", async () => {
    const [nuxtConfig, openRouterRoute, mcpHandler] = await Promise.all([
      readFile(new URL("nuxt.config.ts", root), "utf8"),
      readFile(new URL("server/api/openrouter.post.js", root), "utf8"),
      readFile(new URL("server/mcp/index.js", root), "utf8"),
    ]);
    expect(nuxtConfig).toMatch(/supabaseServiceRoleKey: ""/);
    expect(nuxtConfig).toMatch(/mcpGatewayKey: ""/);
    expect(nuxtConfig).not.toMatch(/process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|NUXT_MCP_GATEWAY_KEY)/);
    expect(openRouterRoute).toMatch(/resolveRuntimeSecret\([\s\S]*SUPABASE_SERVICE_ROLE_KEY/);
    expect(mcpHandler).toMatch(/resolveRuntimeSecret\([\s\S]*NUXT_MCP_GATEWAY_KEY/);
  });

  it("bounds every enumerable MCP read and applies database query limits", async () => {
    const [tools, cvRepository, blockRepository, readService] = await Promise.all([
      Promise.all([
        "list-cvs.js", "list-cv-revisions.js", "list-editing-sessions.js", "list-cv-blocks.js",
      ].map((file) => readFile(new URL(`server/mcp/tools/read/${file}`, root), "utf8"))),
      readFile(new URL("src/infrastructure/cvs/createSupabaseCvRepository.js", root), "utf8"),
      readFile(new URL("src/infrastructure/blocks/createSupabaseBlockRepository.js", root), "utf8"),
      readFile(new URL("server/utils/mcpReadService.js", root), "utf8"),
    ]);
    for (const tool of tools) {
      expect(tool).toMatch(/limit: z\.number\(\)\.int\(\)\.min\(1\)\.max\(100\)/);
    }
    expect(cvRepository.match(/\.limit\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(blockRepository).toMatch(/\.limit\(query\.limit\)/);
    expect(blockRepository).toMatch(/rpc\("search_mcp_cv_block_ids"/);
    expect(blockRepository.indexOf('rpc("search_mcp_cv_block_ids"')).toBeLessThan(blockRepository.indexOf(".limit(query.limit)"));
    expect(blockRepository).toMatch(/foreignTable: "versions"/);
    expect(readService).toMatch(/versionHistoryLimit: 1/);
    expect(readService).toMatch(/MAX_MCP_READ_BYTES/);
    expect(readService).toMatch(/cvWorkspace\.get\(cvId\)/);
    expect(readService).not.toMatch(/\(await listCvs\(\)\)\.find/);
    expect(cvRepository).toMatch(/if \(ids\?\.length\) request = request\.in\("id", ids\)\.limit\(ids\.length\)/);
  });

  it("keeps rate limits and audit hooks on authenticated reads and mutations", async () => {
    const [handler, readTool, changeTool, hardening, edgeRateLimit, bodyLimit] = await Promise.all([
      readFile(new URL("server/mcp/index.js", root), "utf8"),
      readFile(new URL("server/utils/mcpReadTool.js", root), "utf8"),
      readFile(new URL("server/utils/mcpChangeTool.js", root), "utf8"),
      readFile(new URL("server/utils/mcpToolHardening.js", root), "utf8"),
      readFile(new URL("netlify/edge-functions/mcp-rate-limit.js", root), "utf8"),
      readFile(new URL("server/middleware/00-mcp-body-limit.js", root), "utf8"),
    ]);
    expect(handler).toMatch(/mcpAuthenticationRateLimit/i);
    expect(handler).toMatch(/gatewayKey: resolveRuntimeSecret\([\s\S]*config\.mcpGatewayKey[\s\S]*NUXT_MCP_GATEWAY_KEY/);
    expect(readTool).toMatch(/runHardenedMcpTool[\s\S]*kind: "read"/i);
    expect(changeTool).toMatch(/runHardenedMcpTool[\s\S]*kind: "mutation"/i);
    expect(`${readTool}\n${changeTool}`).toMatch(/recordMcpAuditEvent|runHardenedMcpTool/i);
    expect(hardening).toMatch(/enforceMcpSharedRateLimit/);
    expect(edgeRateLimit).toMatch(/path: "\/mcp"[\s\S]*rateLimit[\s\S]*aggregateBy: \["ip", "domain"\]/);
    expect(bodyLimit).toMatch(/readMcpBodyLimited[\s\S]*MAX_MCP_REQUEST_BYTES[\s\S]*statusCode: cause\.statusCode/);
  });
});
