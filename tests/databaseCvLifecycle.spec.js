import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("CV and Editing Session lifecycle migration", () => {
  async function migration() {
    return readFile(new URL("database/cv_lifecycle.sql", root), "utf8");
  }

  it("extends Change Proposals with typed copy and archive operations", async () => {
    const sql = await migration();
    expect(sql).toMatch(/^begin;/i);
    for (const operation of ["copy_to_new_version", "copy_for_new_role", "archive_editing_session", "restore_editing_session", "archive_cv", "restore_cv"]) {
      expect(sql).toContain(operation);
    }
    expect(sql).toMatch(/create or replace function public\.create_cv_lifecycle_proposal/i);
    expect(sql).toMatch(/Lifecycle operation and target types do not match/i);
    expect(sql).toMatch(/cv_documents_publication_state_check[\s\S]*status in \('draft', 'archived'\)/i);
    expect(sql).toMatch(/revoke insert, update, delete on public\.cv_documents from authenticated/i);
    expect(sql).toMatch(/grant insert \(owner_id, name, theme_id, profile, summary, summary_provenance\)/i);
    expect(sql).toMatch(/grant update \(name, theme_id, profile, summary, summary_provenance\)/i);
    expect(sql).toMatch(/create policy "Owners read their CV compositions"/i);
    expect(sql).toMatch(/create policy "Owners manage active CV compositions"[\s\S]*document\.status <> 'archived'/i);
    expect(sql).toMatch(/create trigger reject_archived_cv_session_mutation/i);
    expect(sql).toMatch(/insert into public\.cv_change_proposals/i);
    expect(sql).not.toMatch(/update public\.cv_editing_sessions[\s\S]*create or replace function public\.apply_cv_lifecycle_proposal/i);
    expect(sql.trim()).toMatch(/commit;$/i);
  });

  it("copies atomically while retaining source state and new-role v1 semantics", async () => {
    const sql = await migration();
    const apply = sql.slice(sql.indexOf("create or replace function public.apply_cv_lifecycle_proposal"), sql.indexOf("revoke all on function public.apply_cv_lifecycle_proposal"));
    expect(apply).toMatch(/from public\.cv_change_proposals[\s\S]*for update/i);
    expect(apply).toMatch(/from public\.cv_editing_sessions[\s\S]*for share/i);
    expect(apply).toMatch(/insert into public\.cv_documents/i);
    expect(apply).toMatch(/insert into public\.cv_editing_sessions/i);
    expect(apply).toMatch(/base_revision_id[\s\S]*null/i);
    expect(apply).toMatch(/insert into public\.cv_editing_session_compositions[\s\S]*select/i);
    expect(apply).not.toMatch(/delete from public\.cv_editing_sessions/i);
  });

  it("archives and restores retained state without cascading to CV Blocks", async () => {
    const sql = await migration();
    const apply = sql.slice(sql.indexOf("create or replace function public.apply_cv_lifecycle_proposal"), sql.indexOf("revoke all on function public.apply_cv_lifecycle_proposal"));
    expect(apply).toMatch(/status = 'archived'/i);
    expect(apply).toMatch(/status = 'open'/i);
    expect(apply).toMatch(/update public\.cv_documents/i);
    expect(apply).not.toMatch(/update public\.cv_blocks/i);
    expect(apply).not.toMatch(/delete from public\.cv_editing_session_compositions/i);
  });

  it("keeps lifecycle apply idempotent and optimistic for mutable sources", async () => {
    const sql = await migration();
    const apply = sql.slice(sql.indexOf("create or replace function public.apply_cv_lifecycle_proposal"), sql.indexOf("revoke all on function public.apply_cv_lifecycle_proposal"));
    expect(apply).toMatch(/if change_proposal\.status = 'applied'[\s\S]*return/i);
    expect(apply).toMatch(/optimistic_version is distinct from change_proposal\.base_optimistic_version/i);
    expect(apply).toMatch(/status = 'invalidated'/i);
    expect(sql).toMatch(/revoke all on function public\.apply_cv_lifecycle_proposal\(uuid\)[\s\S]*from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.apply_cv_lifecycle_proposal\(uuid\)[\s\S]*to authenticated/i);
  });
});
