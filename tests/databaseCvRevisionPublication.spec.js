import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("explicit CV Revision publication migration", () => {
  async function migration() {
    return readFile(new URL("database/cv_revision_publication.sql", root), "utf8");
  }

  it("creates reviewed publish and withdrawal proposal boundaries", async () => {
    const sql = await migration();
    expect(sql).toMatch(/^begin;/i);
    expect(sql).toMatch(/publish_revision/);
    expect(sql).toMatch(/withdraw_publication/);
    expect(sql).toMatch(/create_cv/);
    expect(sql).toMatch(/create_cv_block/);
    expect(sql).toMatch(/duplicate_cv_block/);
    expect(sql).toMatch(/delete_cv_block/);
    expect(sql).toMatch(/create or replace function public\.create_cv_publication_proposal/i);
    expect(sql).toMatch(/create or replace function public\.apply_cv_publication_proposal/i);
    expect(sql).toMatch(/status = 'applied'/i);
    expect(sql).toMatch(/revoke all on function public\.publish_cv_document\(uuid, text\) from authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.unpublish_cv_document\(uuid\) from authenticated/i);
  });

  it("pins one stable slug to an owned exact Revision and supports rollback", async () => {
    const sql = await migration();
    expect(sql).toMatch(/revision\.id = v_target_id[\s\S]*revision\.cv_id = v_cv_id[\s\S]*revision\.owner_id = v_owner_id/i);
    expect(sql).toMatch(/published_revision_id = v_revision_id/i);
    expect(sql).toMatch(/slug = coalesce\(document\.slug, v_slug\)/i);
    expect(sql).toMatch(/rolls back/i);
    expect(sql).toMatch(/beforeStatus/i);
    expect(sql).toMatch(/document\.status::text is distinct from v_before_status/i);
    expect(sql).not.toMatch(/update public\.cv_revisions/i);
  });

  it("withdraws access without deleting the CV, Revision, slug, or pin", async () => {
    const sql = await migration();
    expect(sql).toMatch(/set status = 'draft', published_at = null/i);
    expect(sql).not.toMatch(/delete from public\.cv_documents/i);
    expect(sql).not.toMatch(/delete from public\.cv_revisions/i);
    expect(sql).not.toMatch(/published_revision_id = null/i);
    expect(sql).not.toMatch(/slug = null/i);
    expect(sql.trim()).toMatch(/commit;$/i);
  });
});
