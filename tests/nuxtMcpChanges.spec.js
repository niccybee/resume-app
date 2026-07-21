import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("Nuxt MCP Change Proposal surface", () => {
  it("discovers only typed propose, apply, and discard mutation tools", async () => {
    const directory = new URL("server/mcp/tools/write/", root);
    const files = (await readdir(directory)).filter((file) => file.endsWith(".js"));
    const source = (await Promise.all(files.map((file) => (
      readFile(new URL(file, directory), "utf8")
    )))).join("\n");

    for (const name of ["propose_content_changes", "apply_change_proposal", "discard_change_proposal"]) {
      expect(source).toContain(`name: "${name}"`);
    }
    expect(source).toMatch(/z\.discriminatedUnion/);
    expect(source).toMatch(/append_block_version/);
    expect(source).toMatch(/replace_working_state/);
    expect(source).not.toMatch(/name: "(save|update|delete|append)_/);
  });

  it("keeps MCP mutations on the authenticated shared application boundary", async () => {
    const service = await readFile(new URL("server/utils/mcpChangeService.js", root), "utf8");
    expect(service).toMatch(/event\.context\.supabase/);
    expect(service).toMatch(/event\.context\.user/);
    expect(service).toMatch(/createCvWorkspace/);
    expect(service).toMatch(/createBlockLibrary/);
    expect(service).toMatch(/proposeContentChanges/);
    expect(service).not.toMatch(/service.?role/i);
  });
});
