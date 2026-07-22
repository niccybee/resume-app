import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("CV Revision migration", () => {
  it("backfills every existing CV into an immutable v1 and exact ordered Composition", async () => {
    const migration = await readFile(
      new URL("database/cv_revisions.sql", root),
      "utf8",
    );

    expect(migration).toMatch(/create table if not exists public\.cv_revisions/i);
    expect(migration).toMatch(/unique\s*\(cv_id,\s*revision_number\)/i);
    expect(migration).toMatch(/create table if not exists public\.cv_revision_compositions/i);
    expect(migration).toMatch(/unique\s*\(revision_id,\s*block_id\)/i);
    expect(migration).toMatch(/unique\s*\(revision_id,\s*section,\s*position\)/i);
    expect(migration).toMatch(/foreign key\s*\(base_revision_id,\s*cv_id\)[\s\S]*references public\.cv_revisions\s*\(id,\s*cv_id\)/i);
    expect(migration).toMatch(/foreign key\s*\(revision_id,\s*cv_id\)[\s\S]*references public\.cv_revisions\s*\(id,\s*cv_id\)/i);
    expect(migration).toMatch(/insert into public\.cv_revisions[\s\S]*revision_number[\s\S]*select[\s\S]*document\.id[\s\S]*1/i);
    expect(migration).toMatch(/insert into public\.cv_revision_compositions[\s\S]*composition\.block_id[\s\S]*composition\.version_id[\s\S]*composition\.position/i);
    expect(migration).toMatch(/before update or delete on public\.cv_revisions/i);
    expect(migration).toMatch(/before update or delete on public\.cv_revision_compositions/i);
  });

  it("rejects duplicate Block identities before idempotent backfill writes", async () => {
    const migration = await readFile(
      new URL("database/cv_revisions.sql", root),
      "utf8",
    );
    const duplicateValidation = migration.indexOf("duplicate CV Block identities");
    const revisionBackfill = migration.indexOf("insert into public.cv_revisions");

    expect(migration).toMatch(/^begin;/i);
    expect(duplicateValidation).toBeGreaterThan(-1);
    expect(revisionBackfill).toBeGreaterThan(duplicateValidation);
    expect(migration).toMatch(/with inserted_revisions as\s*\([\s\S]*where not exists\s*\([\s\S]*revision_number\s*=\s*1/i);
    expect(migration).toMatch(/join inserted_revisions as revision[\s\S]*on revision\.cv_id = composition\.cv_id/i);
    expect(migration.trim()).toMatch(/commit;$/i);
  });

  it("pins existing public slugs to v1 and reads their immutable Revision", async () => {
    const [migration, publicRead] = await Promise.all([
      readFile(new URL("database/cv_revisions.sql", root), "utf8"),
      readFile(new URL("database/cv_public_read.sql", root), "utf8"),
    ]);

    expect(migration).toMatch(/add column if not exists published_revision_id uuid/i);
    expect(migration).toMatch(/foreign key\s*\(published_revision_id,\s*id\)[\s\S]*references public\.cv_revisions\s*\(id,\s*cv_id\)/i);
    expect(migration).toMatch(/set published_revision_id\s*=\s*revision\.id/i);
    expect(migration).toMatch(/document\.status\s*=\s*'published'/i);
    expect(publicRead).toMatch(/document\.published_revision_id/i);
    expect(publicRead).toMatch(/public\.cv_revision_compositions/i);
    expect(publicRead).toMatch(/public\.cv_revisions/i);
    expect(publicRead).not.toMatch(/from public\.cv_compositions/i);
    expect(publicRead).not.toMatch(/coalesce\(revision\.(theme_id|profile|summary)/i);
    expect(publicRead).toMatch(/join public\.cv_revisions as revision[\s\S]*revision\.id = document\.published_revision_id/i);
  });

  it("keeps legacy publishing usable by atomically selecting or creating v1", async () => {
    const migration = await readFile(
      new URL("database/cv_revisions.sql", root),
      "utf8",
    );

    expect(migration).toMatch(/create or replace function public\.publish_cv_document\s*\(/i);
    expect(migration).toMatch(/v_revision_id\s*:=\s*document\.published_revision_id/i);
    expect(migration).toMatch(/if v_revision_id is null then[\s\S]*insert into public\.cv_revisions/i);
    expect(migration).toMatch(/insert into public\.cv_revision_compositions[\s\S]*where composition\.cv_id = p_cv_id/i);
    expect(migration).toMatch(/set[\s\S]*status = 'published'[\s\S]*published_revision_id = v_revision_id/i);
    expect(migration).toMatch(/security definer[\s\S]*set search_path = ''/i);
    expect(migration).toMatch(/v_owner_id uuid := \(select auth\.uid\(\)\)/i);
    expect(migration).toMatch(/source\.owner_id = v_owner_id[\s\S]*for update/i);
    expect(migration).toMatch(/revoke all on function public\.publish_cv_document\(uuid, text\)[\s\S]*from public, anon/i);
    expect(migration).toMatch(/grant execute on function public\.publish_cv_document\(uuid, text\)[\s\S]*to authenticated/i);
  });

  it("indexes the Revision Composition ownership and identity constraints", async () => {
    const migration = await readFile(
      new URL("database/cv_revisions.sql", root),
      "utf8",
    );

    expect(migration).toMatch(/create index if not exists cv_revision_compositions_cv_id_idx[\s\S]*on public\.cv_revision_compositions\(cv_id\)/i);
    expect(migration).toMatch(/create index if not exists cv_revision_compositions_owner_id_idx[\s\S]*on public\.cv_revision_compositions\(owner_id\)/i);
    expect(migration).toMatch(/create index if not exists cv_revision_compositions_block_id_idx[\s\S]*on public\.cv_revision_compositions\(block_id\)/i);
    expect(migration).toMatch(/create index if not exists cv_revisions_base_revision_id_idx[\s\S]*on public\.cv_revisions\(base_revision_id\)/i);
    expect(migration).toMatch(/create index if not exists cv_documents_published_revision_id_idx[\s\S]*on public\.cv_documents\(published_revision_id\)/i);
  });
});
