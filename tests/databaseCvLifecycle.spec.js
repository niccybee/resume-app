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
    for (const operation of ["create_cv", "start_editing_session", "resume_editing_session", "finish_editing_session", "copy_to_new_version", "copy_for_new_role", "archive_editing_session", "restore_editing_session", "archive_cv", "restore_cv", "archive_cv_block", "restore_cv_block", "create_cv_block", "duplicate_cv_block", "delete_cv_block"]) {
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
    expect(sql).toMatch(/revoke execute on function public\.start_cv_editing_session\(uuid, uuid\) from authenticated/i);
    expect(sql).toMatch(/revoke execute on function public\.finish_cv_editing_session\(uuid, integer\) from authenticated/i);
    expect(sql).not.toMatch(/update public\.cv_editing_sessions[\s\S]*create or replace function public\.apply_cv_lifecycle_proposal/i);
    expect(sql.trim()).toMatch(/commit;$/i);
  });

  it("starts, resumes, finishes, and manages eligible CV Blocks only on apply", async () => {
    const sql = await migration();
    const create = sql.slice(sql.indexOf("create or replace function public.create_cv_lifecycle_proposal"), sql.indexOf("revoke all on function public.create_cv_lifecycle_proposal"));
    const apply = sql.slice(sql.indexOf("create or replace function public.apply_cv_lifecycle_proposal"), sql.indexOf("revoke all on function public.apply_cv_lifecycle_proposal"));
    expect(create).toMatch(/baseRevisionId/i);
    expect(create).toMatch(/baseVersionId/i);
    expect(create).toMatch(/An Experience Block requires a valid Employment Occasion/i);
    expect(create).toMatch(/is distinct from \(case p_operation->>'kind'[\s\S]*end\) then/i);
    expect(create).not.toMatch(/start_cv_editing_session/i);
    expect(create).not.toMatch(/finish_cv_editing_session/i);
    expect(apply).toMatch(/start_cv_editing_session/i);
    expect(apply).toMatch(/finish_cv_editing_session/i);
    expect(apply).toMatch(/published_revision_id/i);
    expect(apply).toMatch(/archive_cv_block/i);
    expect(apply).toMatch(/insert into public\.cv_documents\(id, owner_id, name, status, profile\)[\s\S]*change_proposal\.target_id/i);
    expect(apply).toMatch(/insert into public\.cv_editing_sessions[\s\S]*v_new_session_id/i);
    expect(apply).toMatch(/save_cv_block_version/i);
    expect(apply).toMatch(/insert into public\.cv_blocks\(id, owner_id, kind, title, status\)[\s\S]*p_block_id => change_proposal\.target_id/i);
    expect(apply).toMatch(/duplicate_cv_block/i);
    expect(apply).toMatch(/delete_cv_block/i);
    expect(apply).toMatch(/non-archived CV Composition/i);
    expect(create).not.toMatch(/cv_editing_session_compositions/i);
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

  it("keeps direct lifecycle RPCs revoked in migrations applied after lifecycle proposals", async () => {
    const [blocks, contraction] = await Promise.all([
      readFile(new URL("database/cv_block_identity_lifecycle.sql", root), "utf8"),
      readFile(new URL("database/cv_legacy_contraction.sql", root), "utf8"),
    ]);
    expect(blocks).toMatch(/revoke execute on function public\.set_cv_block_status\(uuid, text\) from authenticated/i);
    expect(blocks).not.toMatch(/grant execute on function public\.set_cv_block_status\(uuid, text\) to authenticated/i);
    expect(contraction).toMatch(/revoke execute on function public\.start_cv_editing_session\(uuid, uuid\)[\s\S]*from authenticated/i);
    expect(contraction).not.toMatch(/grant execute on function public\.start_cv_editing_session\(uuid, uuid\)[\s\S]*to authenticated/i);
  });

  it("ships the MCP CRUD database contract through the Supabase migration chain", async () => {
    const sql = await readFile(
      new URL(
        "supabase/migrations/20260728052000_repair_mcp_crud_database_contract.sql",
        root,
      ),
      "utf8",
    );
    const targetResolutionSql = await readFile(
      new URL(
        "supabase/migrations/20260728070800_fix_mcp_create_block_target_resolution.sql",
        root,
      ),
      "utf8",
    );
    const dateValidationSql = await readFile(
      new URL(
        "supabase/migrations/20260728071200_restore_cv_block_date_validation.sql",
        root,
      ),
      "utf8",
    );
    const create = targetResolutionSql.slice(
      targetResolutionSql.indexOf("create or replace function public.create_cv_lifecycle_proposal"),
      targetResolutionSql.indexOf("revoke all on function public.create_cv_lifecycle_proposal"),
    );
    const apply = sql.slice(
      sql.indexOf("create or replace function public.apply_cv_lifecycle_proposal"),
      sql.indexOf("revoke all on function public.apply_cv_lifecycle_proposal"),
    );
    const audit = sql.slice(
      sql.indexOf("create or replace function public.record_mcp_audit_event"),
      sql.indexOf("revoke all on function public.record_mcp_audit_event"),
    );

    expect(create).toMatch(
      /'archive_cv_block', 'restore_cv_block', 'create_cv_block', 'duplicate_cv_block', 'delete_cv_block'\) and v_target_type <> 'cv_block'/i,
    );
    expect(create).toMatch(
      /when v_type in \('copy_to_new_version', 'copy_for_new_role'\)[\s\S]*then p_operation #>> '\{source,type\}'[\s\S]*else p_operation #>> '\{target,type\}'/i,
    );
    expect(create).not.toMatch(
      /v_target_type text := coalesce\(p_operation #>> '\{source,type\}'/i,
    );
    expect(create).toMatch(/An Experience Block requires a valid Employment Occasion/i);
    expect(create).toMatch(/A sidebar CV Block requires a sidebar context/i);
    expect(dateValidationSql).toMatch(
      /create or replace function public\.is_valid_cv_block_date\(p_value text\)/i,
    );
    expect(dateValidationSql).toMatch(
      /revoke all on function public\.is_valid_cv_block_date\(text\)[\s\S]*from public, anon, authenticated/i,
    );
    expect(apply).toMatch(/change_proposal\.operation_type = 'create_cv_block'/i);
    expect(apply).toMatch(/save_cv_block_version/i);
    for (const operation of [
      "propose_create_cv",
      "propose_update_cv",
      "propose_create_cv_block",
      "propose_update_cv_block",
      "propose_duplicate_cv_block",
      "propose_archive_cv_block",
      "propose_restore_cv_block",
      "propose_delete_cv_block",
    ]) {
      expect(audit).toContain(operation);
    }
  });
});
