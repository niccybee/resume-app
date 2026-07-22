import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("content Change Proposal migration", () => {
  async function migration() {
    return readFile(new URL("database/cv_content_change_proposals.sql", root), "utf8");
  }

  it("creates typed content proposals without mutating CV Blocks or Working Compositions", async () => {
    const sql = await migration();
    const create = sql.slice(sql.indexOf("create or replace function public.create_cv_content_change_proposal"), sql.indexOf("revoke all on function public.create_cv_content_change_proposal"));
    expect(create).toMatch(/append_block_version/i);
    expect(create).toMatch(/replace_working_state/i);
    expect(create).toMatch(/schemaVersion/i);
    expect(create).toMatch(/structured_diff/i);
    expect(create).toMatch(/validate_cv_block_proposal_content/i);
    expect(sql).toMatch(/jsonb_object_keys\(p_content\)[\s\S]*field outside schema version/i);
    expect(sql).toMatch(/CV Block dates must use YYYY, YYYY-MM, or YYYY-MM-DD format/i);
    expect(sql).toMatch(/public\.is_valid_cv_block_date\(field\.value\)/i);
    expect(create).toMatch(/having count\(\*\) > 1/i);
    expect(create).not.toMatch(/insert into public\.cv_block_versions/i);
    expect(create).not.toMatch(/update public\.cv_editing_sessions/i);
  });

  it("applies content changes atomically once and returns affected identities", async () => {
    const sql = await migration();
    const apply = sql.slice(sql.indexOf("create or replace function public.apply_cv_content_change_proposal"), sql.indexOf("revoke all on function public.apply_cv_content_change_proposal"));
    expect(apply).toMatch(/from public\.cv_change_proposals[\s\S]*for update/i);
    expect(apply).toMatch(/if change_proposal\.status = 'applied'[\s\S]*return/i);
    expect(apply).toMatch(/optimistic_version is distinct from change_proposal\.base_optimistic_version/i);
    expect(apply).toMatch(/append_block_version/i);
    expect(apply).toMatch(/save_cv_block_version/i);
    expect(apply).toMatch(/stale-block-version/i);
    expect(apply).toMatch(/reason', 'archived-cv'/i);
    expect(apply).toMatch(/select distinct[\s\S]*order by source\.id[\s\S]*for update of source/i);
    expect(apply).toMatch(/optimistic_version = optimistic_version \+ 1/i);
    expect(apply).toMatch(/affectedIdentities/i);
    expect(apply).toMatch(/set version_id[\s\S]*jsonb_each_text\(version_replacements\)/i);
    expect(sql.trim()).toMatch(/commit;$/i);
    expect(sql).toMatch(/source_type in \('human', 'ai', 'import', 'mcp'\)/i);
  });
});
