import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("Nuxt MCP CV and CV Block CRUD proposal surface", () => {
  it("publishes dedicated proposal tools without bypassing explicit apply", async () => {
    const directory = new URL("server/mcp/tools/write/", root);
    const files = (await readdir(directory))
      .filter((file) => file.startsWith("propose-") && file.endsWith(".js"));
    const sources = await Promise.all(files.map(async (file) => ({
      file,
      source: await readFile(new URL(file, directory), "utf8"),
    })));
    const source = sources.map(({ source: value }) => value).join("\n");

    for (const name of [
      "propose_create_cv",
      "propose_update_cv",
      "propose_archive_cv",
      "propose_restore_cv",
      "propose_create_cv_block",
      "propose_update_cv_block",
      "propose_duplicate_cv_block",
      "propose_archive_cv_block",
      "propose_restore_cv_block",
      "propose_delete_cv_block",
    ]) {
      expect(source).toContain(`name: "${name}"`);
    }
    for (const { file, source: tool } of sources.filter(({ file }) => (
      file !== "propose-content-changes.js"
      && file !== "propose-lifecycle-change.js"
    ))) {
      expect(tool, file).toContain("defineMcpChangeTool");
      expect(tool, file).toMatch(/propose(ContentChanges|LifecycleChange)/);
      expect(tool, file).not.toMatch(/applyChangeProposal|createSupabase|service.?role/i);
    }
  });

  it("describes immutable Block Version updates and retained CV deletion semantics", async () => {
    const [updateBlock, deleteBlock, archiveCv] = await Promise.all([
      readFile(new URL("server/mcp/tools/write/propose-update-cv-block.js", root), "utf8"),
      readFile(new URL("server/mcp/tools/write/propose-delete-cv-block.js", root), "utf8"),
      readFile(new URL("server/mcp/tools/write/propose-archive-cv.js", root), "utf8"),
    ]);

    expect(updateBlock).toMatch(/Append an immutable Block Version/i);
    expect(updateBlock).toMatch(/basedOnVersionId/);
    expect(deleteBlock).toMatch(/only when no CV Composition references/i);
    expect(deleteBlock).toMatch(/Otherwise archive it/i);
    expect(archiveCv).toMatch(/does not archive shared CV Blocks/i);
  });
});
