import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("Nuxt MCP lifecycle proposal surface", () => {
  it("exposes one typed lifecycle proposal tool and no direct lifecycle mutations", async () => {
    const source = await readFile(
      new URL("server/mcp/tools/write/propose-lifecycle-change.js", root),
      "utf8",
    );
    expect(source).toContain('name: "propose_lifecycle_change"');
    expect(source).toMatch(/z\.discriminatedUnion/);
    expect(source).toMatch(/employmentOccasion: employmentOccasionSchema\.optional/);
    for (const operation of [
      "start_editing_session", "resume_editing_session", "copy_to_new_version",
      "copy_for_new_role", "archive_editing_session", "restore_editing_session",
      "finish_editing_session", "archive_cv", "restore_cv", "archive_cv_block",
      "restore_cv_block", "create_cv_block", "duplicate_cv_block", "delete_cv_block",
      "publish_revision", "withdraw_publication",
    ]) expect(source).toContain(operation);
    expect(source).not.toMatch(/name: "(start|resume|copy|archive|restore|finish|publish|unpublish)_/);
  });

  it("delegates lifecycle proposals to the authenticated shared application service", async () => {
    const source = await readFile(new URL("server/utils/mcpChangeService.js", root), "utf8");
    expect(source).toMatch(/proposeLifecycleChange/);
    expect(source).toMatch(/event\.context\.supabase/);
    expect(source).toMatch(/event\.context\.user/);
    expect(source).not.toMatch(/service.?role/i);
  });
});
