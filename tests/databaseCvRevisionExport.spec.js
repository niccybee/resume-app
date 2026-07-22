import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("immutable CV Revision export snapshot", () => {
  it("returns one exact owned Revision with ordered immutable Block Version content", async () => {
    const sql = await readFile(new URL("database/cv_revision_export.sql", root), "utf8");
    expect(sql).toMatch(/create or replace function public\.get_cv_revision_snapshot\([\s\n]*p_cv_id uuid,[\s\n]*p_revision_id uuid[\s\n]*\)/i);
    expect(sql).toMatch(/revision\.id = p_revision_id[\s\S]*revision\.cv_id = p_cv_id[\s\S]*revision\.owner_id = v_owner_id/i);
    expect(sql).toMatch(/join public\.cv_block_versions/i);
    expect(sql).toMatch(/version\.id = composition\.version_id/i);
    expect(sql).toMatch(/order by composition\.section, composition\.position/i);
    expect(sql).not.toMatch(/current_version_id/i);
  });
});
