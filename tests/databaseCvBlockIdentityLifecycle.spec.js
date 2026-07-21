import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("CV Block identity and lifecycle migration", () => {
  async function migration() {
    return readFile(new URL("database/cv_block_identity_lifecycle.sql", root), "utf8");
  }

  it("adds a versioned schema registry for every supported CV Block kind", async () => {
    const sql = await migration();
    expect(sql).toMatch(/^begin;/i);
    expect(sql).toMatch(/add column if not exists schema_version text not null default '1'/i);
    expect(sql).toMatch(/create or replace function public\.validate_cv_block_content/i);
    for (const kind of ["experience", "skill", "certification", "education", "interest"]) {
      expect(sql).toContain(`'${kind}'`);
    }
    expect(sql).toMatch(/unsupported CV Block schema version/i);
    expect(sql).toMatch(/Experience optional fields must be strings/i);
    expect(sql).toMatch(/Skill level must be a string/i);
    expect(sql).toMatch(/Certification optional fields must be strings/i);
    expect(sql).toMatch(/Education optional fields must be strings/i);
    expect(sql).toMatch(/not \(p_content \? 'text'\)[\s\S]*not \(p_content \? 'name'\)[\s\S]*not \(p_content \? 'institution'\)/i);
    expect(sql).toMatch(/p_kind in \('skill', 'interest'\) and \(p_content \? 'keywords'\)/i);
    expect(sql).toMatch(/p_kind = 'experience' and \(p_content \? 'highlights'\)/i);
    expect(sql).toMatch(/p_kind = 'education' and \(p_content \? 'courses'\)/i);
    expect(sql).toMatch(/for existing_version in[\s\S]*perform public\.validate_cv_block_content/i);
    expect(sql.trim()).toMatch(/commit;$/i);
  });

  it("keeps Block Versions append-only with same-identity base provenance", async () => {
    const sql = await migration();
    expect(sql).toMatch(/revoke insert, update, delete on public\.cv_block_versions from authenticated/i);
    expect(sql).toMatch(/based_on_version_id[\s\S]*base_version\.block_id <> v_block\.id/i);
    expect(sql).toMatch(/current_version_id is distinct from p_based_on_version_id/i);
    expect(sql).toMatch(/p_based_on_version_id is not null[\s\S]*new CV Block identity cannot use based_on_version_id/i);
    expect(sql).toMatch(/version_number[\s\S]*coalesce\(max\(version_number\), 0\) \+ 1/i);
  });

  it("enforces owner, Block identity, and exact Version identity for every Composition", async () => {
    const sql = await migration();
    expect(sql).toMatch(/create or replace function public\.validate_cv_composition_identity/i);
    for (const table of ["cv_compositions", "cv_editing_session_compositions", "cv_revision_compositions"]) {
      expect(sql).toMatch(new RegExp(`before insert or update on public\\.${table}`, "i"));
    }
    expect(sql).toMatch(/version\.block_id <> new\.block_id[\s\S]*version\.owner_id <> new\.owner_id/i);
  });

  it("duplicates independent identities and prevents referenced deletion", async () => {
    const sql = await migration();
    expect(sql).toMatch(/create or replace function public\.duplicate_cv_block/i);
    expect(sql).toMatch(/duplicate_cv_block[\s\S]*perform public\.validate_cv_block_content\(source_block\.kind, source_version\.schema_version, source_version\.content\)/i);
    expect(sql).toMatch(/insert into public\.cv_blocks/i);
    expect(sql).toMatch(/insert into public\.cv_block_versions/i);
    expect(sql).toMatch(/based_on_version_id[\s\S]*null/i);
    expect(sql).toMatch(/create or replace function public\.delete_cv_block/i);
    expect(sql).toMatch(/cv_compositions[\s\S]*cv_editing_session_compositions[\s\S]*cv_revision_compositions/i);
    expect(sql).toMatch(/CV Block is referenced; archive it instead/i);
    expect(sql).toMatch(/create or replace function public\.set_cv_block_status/i);
  });
});
