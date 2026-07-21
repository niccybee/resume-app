import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("legacy mutable CV contraction", () => {
  async function migration() {
    return readFile(new URL("database/cv_legacy_contraction.sql", root), "utf8");
  }

  it("creates new CV content only in an initial Working Composition", async () => {
    const sql = await migration();
    expect(sql.indexOf("Legacy CV Composition data has not been verified")).toBeLessThan(
      sql.indexOf("create or replace function public.create_cv_with_editing_session"),
    );
    expect(sql).toMatch(/create or replace function public\.create_cv_with_editing_session/i);
    expect(sql).toMatch(/insert into public\.cv_documents[\s\S]*'\{\}'::jsonb/i);
    expect(sql).toMatch(/insert into public\.cv_editing_sessions/i);
    expect(sql).toMatch(/insert into public\.cv_editing_session_compositions/i);
    expect(sql).not.toMatch(/insert into public\.cv_compositions/i);
  });

  it("contracts only after one immutable Revision exactly matches all legacy content", async () => {
    const sql = await migration();
    const preflight = sql.slice(0, sql.indexOf("create or replace function public.create_cv_with_editing_session"));
    expect(preflight).toMatch(/lock table public\.cv_documents, public\.cv_compositions[\s\S]*in share row exclusive mode/i);
    expect(preflight.indexOf("lock table")).toBeLessThan(preflight.indexOf("do $$"));
    expect(preflight).toMatch(/revision\.theme_id is not distinct from document\.theme_id/i);
    expect(preflight).toMatch(/revision\.profile is not distinct from document\.profile/i);
    expect(preflight).toMatch(/revision\.summary is not distinct from document\.summary/i);
    expect(preflight).toMatch(/revision\.summary_provenance is not distinct from document\.summary_provenance/i);
    expect(preflight.match(/\bexcept\b/gi)).toHaveLength(2);
    expect(preflight).toMatch(/mutable CV state has not been captured as one exact immutable CV Revision/i);
  });

  it("removes authenticated writes from legacy documents, compositions, and RPCs", async () => {
    const sql = await migration();
    expect(sql).toMatch(/revoke insert, update, delete on public\.cv_documents from authenticated/i);
    expect(sql).toMatch(/revoke insert \(owner_id, name, theme_id, profile, summary, summary_provenance\)[\s\S]*from authenticated/i);
    expect(sql).toMatch(/revoke update \(name, theme_id, profile, summary, summary_provenance\)[\s\S]*from authenticated/i);
    expect(sql).toMatch(/revoke all on public\.cv_compositions from authenticated/i);
    expect(sql).toMatch(/grant select on public\.cv_compositions to authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.save_cv_document/i);
    expect(sql).toMatch(/drop policy if exists "Owners manage their CV documents"/i);
    expect(sql).toMatch(/drop policy if exists "Owners create draft CV documents"/i);
    expect(sql).toMatch(/drop policy if exists "Owners update active CV content"/i);
    expect(sql).toMatch(/create policy "Owners read their CV documents"/i);
    expect(sql).toMatch(/create trigger contract_cv_lineage_content[\s\S]*before insert or update on public\.cv_documents/i);
    expect(sql).toMatch(/create trigger reject_legacy_cv_composition_write[\s\S]*before insert or update or delete on public\.cv_compositions/i);
    expect(sql).toMatch(/revoke all on function public\.contract_cv_lineage_content\(\)[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.reject_legacy_cv_composition_write\(\)[\s\S]*from public, anon, authenticated/i);
  });

  it("starts future Editing Sessions without recreating a Revision from legacy mutable content", async () => {
    const sql = await migration();
    const start = sql.slice(
      sql.indexOf("create or replace function public.start_cv_editing_session"),
      sql.indexOf("revoke all on function public.start_cv_editing_session"),
    );
    expect(start).toMatch(/v_base_revision_id is null[\s\S]*insert into public\.cv_editing_sessions/i);
    expect(start).not.toMatch(/public\.cv_compositions/i);
    expect(start).not.toMatch(/insert into public\.cv_revisions/i);
  });

  it("keeps owner RLS enabled across every active aggregate", async () => {
    const files = await Promise.all([
      "cv_documents.sql", "cv_revisions.sql", "cv_editing_sessions.sql", "cv_change_proposals.sql", "cv_block_library.sql",
    ].map((file) => readFile(new URL(`database/${file}`, root), "utf8")));
    const combined = files.join("\n");
    for (const table of [
      "cv_documents", "cv_revisions", "cv_revision_compositions", "cv_editing_sessions",
      "cv_editing_session_compositions", "cv_change_proposals", "cv_blocks", "cv_block_versions",
    ]) {
      expect(combined).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
  });

  it("leaves no Nuxt runtime caller for the mutable CV Composition path", async () => {
    const [repository, editor] = await Promise.all([
      readFile(new URL("src/infrastructure/cvs/createSupabaseCvRepository.js", root), "utf8"),
      readFile(new URL("src/views/CvDraftEditor.vue", root), "utf8"),
    ]);
    expect(repository).not.toMatch(/cv_compositions|save_cv_document/i);
    expect(repository).not.toMatch(/select\("\*"\)/);
    expect(editor).not.toMatch(/cvWorkspace\.save\s*\(/);
    expect(editor).toMatch(/cvWorkspace\.createCvEditingSession\s*\(/);
    expect(editor).toMatch(/cvWorkspace\.saveEditingSession\s*\(/);
    expect(editor).not.toMatch(/createSupabaseCvRepository|from\("cv_/);
  });
});
