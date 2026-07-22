import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

const agreedReadTools = [
  "export_cv_revision",
  "get_block_version",
  "get_cv",
  "get_cv_block",
  "get_cv_revision",
  "get_editing_session",
  "get_publication_state",
  "get_supported_schemas",
  "list_cv_blocks",
  "list_cv_revisions",
  "list_cvs",
  "list_editing_sessions",
];

const agreedSchemaResources = [
  "resume-studio://schemas/block-content/v1",
  "resume-studio://schemas/composition/v1",
  "resume-studio://schemas/change-proposal/v1",
  "resume-studio://adapters",
];

describe("Nuxt MCP read surface", () => {
  it("discovers the agreed read-only tools with Zod inputs and versioned envelopes", async () => {
    const directory = new URL("server/mcp/tools/read/", root);
    const files = (await readdir(directory)).filter((file) => file.endsWith(".js"));
    const source = (await Promise.all(files.map((file) => (
      readFile(new URL(file, directory), "utf8")
    )))).join("\n");

    for (const name of agreedReadTools) expect(source).toContain(`name: "${name}"`);
    expect(source).toMatch(/inputSchema:/);
    expect(source).toMatch(/z\.(string|boolean|enum)/);
    expect(source).toMatch(/defineMcpReadTool/);
    expect(source).not.toMatch(/save|apply|archive|restore|finish|publish_revision/);
  });

  it("publishes product schema resources without account data", async () => {
    const directory = new URL("server/mcp/resources/", root);
    const files = (await readdir(directory)).filter((file) => file.endsWith(".js"));
    const source = (await Promise.all(files.map((file) => (
      readFile(new URL(file, directory), "utf8")
    )))).join("\n");

    for (const uri of agreedSchemaResources) expect(source).toContain(`uri: "${uri}"`);
    expect(source).toMatch(/BLOCK_SCHEMA_REGISTRY/);
    expect(source).toMatch(/compositionSchema/);
    expect(source).toMatch(/adapterCapabilities/);
    expect(source).toMatch(/changeProposalSchema/);
  });

  it("keeps request-scoped reads on the authenticated user client", async () => {
    const service = await readFile(
      new URL("server/utils/mcpReadService.js", root),
      "utf8",
    );
    expect(service).toMatch(/event\.context\.supabase/);
    expect(service).toMatch(/event\.context\.user/);
    expect(service).toMatch(/createCvWorkspace/);
    expect(service).toMatch(/createBlockLibrary/);
    expect(service).not.toMatch(/service.?role/i);
  });
});
