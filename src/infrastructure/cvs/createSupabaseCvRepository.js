import { CvWorkspaceError } from "../../domain/cvs/createCvWorkspace";
import { normalizeDraft } from "../../domain/cvs/cvDraft";
import { nextChangeProposalActions } from "../../domain/cvs/changeProposal";

function mapError(error) {
  if (!error) return;
  if (/stale-block-version/i.test(error.message || "")) {
    let context;
    try {
      context = JSON.parse(error.message.slice(error.message.indexOf(":") + 1).trim());
    } catch {}
    throw new CvWorkspaceError(
      "stale-block-version",
      "The CV Block has a newer current Block Version.",
      context,
    );
  }
  if (/Archived CVs must be restored/i.test(error.message || "")) {
    throw new CvWorkspaceError("invalid-lifecycle-transition", error.message);
  }
  if (/stale-proposal/i.test(error.message || "")) {
    let context;
    try {
      context = JSON.parse(error.message.slice(error.message.indexOf(":") + 1).trim());
    } catch {}
    throw new CvWorkspaceError(
      "stale-proposal",
      "Change Proposal is based on stale Editing Session state.",
      context,
    );
  }
  if (/proposal-expired/i.test(error.message || "")) {
    throw new CvWorkspaceError("proposal-expired", "Change Proposal has expired.");
  }
  if (/invalid-proposal-state/i.test(error.message || "")) {
    throw new CvWorkspaceError("invalid-proposal-state", error.message);
  }
  if (error.code === "40001" || /session-conflict/i.test(error.message || "")) {
    throw new CvWorkspaceError(
      "session-conflict",
      "Editing Session changed elsewhere. Resume it before trying again.",
    );
  }
  if (error.code === "55000") {
    throw new CvWorkspaceError("session-finished", error.message || "Editing Session is not open.");
  }
  if (error.code === "23505") {
    throw new CvWorkspaceError("slug-conflict", "That public slug is already in use.");
  }
  if (error.code === "P0002") {
    throw new CvWorkspaceError("not-found", error.message || "CV not found.");
  }
  if (/jwt|auth|permission|row-level security/i.test(error.message || "")) {
    throw new CvWorkspaceError("authentication-required", "Sign in to manage CVs.");
  }
  throw new CvWorkspaceError("repository-error", error.message || "The CV request failed.");
}

const CV_LINEAGE_COLUMNS = "id, name, slug, status, published_at, published_revision_id";

function mapDocument(row) {
  return normalizeDraft({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    publishedAt: row.published_at,
    publishedRevisionId: row.published_revision_id || row.publishedRevisionId,
  });
}

function mapRevision(row) {
  return {
    id: row.id,
    cvId: row.cv_id,
    number: row.revision_number,
    baseRevisionId: row.base_revision_id,
    themeId: row.theme_id,
    profile: row.profile || {},
    summary: row.summary,
    summaryProvenance: row.summary_provenance,
    createdAt: row.created_at,
  };
}

function mapEditingSession(row, selections = []) {
  return {
    id: row.id,
    cvId: row.cv_id,
    baseRevisionId: row.base_revision_id,
    status: row.status,
    optimisticVersion: row.optimistic_version,
    finishedRevisionId: row.finished_revision_id,
    name: row.working_name,
    themeId: row.working_theme_id,
    profile: row.working_profile || {},
    summary: row.working_summary || "",
    summaryProvenance: row.working_summary_provenance,
    selections,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

function mapEditingSessionSelection(item) {
  return {
    blockId: item.block_id,
    versionId: item.version_id,
    section: item.section,
    order: item.position,
    content: item.content || {},
    block: item.display || {},
    group: item.display?.grouping || undefined,
    source: item.source_type
      ? { type: item.source_type, ...(item.source_metadata || {}) }
      : null,
  };
}

function serializeSelections(selections = []) {
  return selections.map((selection) => ({
    block_id: selection.blockId,
    version_id: selection.versionId,
    section: selection.section,
    position: selection.order,
    display: {
      ...(selection.block || {}),
      ...(selection.group ? { grouping: selection.group } : {}),
    },
  }));
}

function mapChangeProposal(row) {
  if (!row) return null;
  const status = row.status;
  return {
    id: row.id,
    schemaVersion: row.schema_version,
    operationType: row.operation_type,
    target: {
      type: row.target_type,
      id: row.target_id,
      cvId: row.target_cv_id,
    },
    baseOptimisticVersion: row.base_optimistic_version,
    operations: row.normalized_operations || [],
    diff: row.structured_diff || {},
    warnings: row.warnings || [],
    status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    result: row.result || null,
    nextActions: nextChangeProposalActions(status),
  };
}

export function createSupabaseCvRepository({ client, getActor } = {}) {
  async function actor({ optional = false } = {}) {
    if (getActor) {
      const user = await getActor();
      if (!user && !optional) {
        throw new CvWorkspaceError("authentication-required", "Sign in to manage CVs.");
      }
      return user || null;
    }
    const { data, error } = await client.auth.getSession();
    if (error && !optional) mapError(error);
    if (!data?.session?.user && !optional) {
      throw new CvWorkspaceError("authentication-required", "Sign in to manage CVs.");
    }
    return data?.session?.user || null;
  }

  async function fetchEditingSession(id) {
    await actor();
    const { data, error } = await client.rpc("get_cv_editing_session", {
      p_session_id: id,
    });
    mapError(error);
    return data
      ? mapEditingSession(data, (data.selections || []).map(mapEditingSessionSelection))
      : null;
  }

  async function fetchChangeProposal(id) {
    await actor();
    const { data, error } = await client.rpc("get_cv_change_proposal", {
      p_proposal_id: id,
    });
    mapError(error);
    return mapChangeProposal(data);
  }

  async function fetchOne(column, value, { published = false } = {}) {
    let request = client.from("cv_documents").select(CV_LINEAGE_COLUMNS).eq(column, value);
    if (published) request = request.eq("status", "published");
    const { data, error } = await request.maybeSingle();
    mapError(error);
    if (!data) return null;
    return mapDocument(data);
  }

  return {
    async list() {
      const user = await actor({ optional: true });
      if (!user) return [];
      const { data, error } = await client
        .from("cv_documents")
        .select(CV_LINEAGE_COLUMNS)
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false });
      mapError(error);
      return (data || []).map((row) => mapDocument(row));
    },

    async get(id) {
      await actor();
      return fetchOne("id", id);
    },

    async listRevisions(cvId) {
      const user = await actor();
      const { data, error } = await client
        .from("cv_revisions")
        .select("id, cv_id, revision_number, base_revision_id, theme_id, profile, summary, summary_provenance, created_at")
        .eq("cv_id", cvId)
        .eq("owner_id", user.id)
        .order("revision_number", { ascending: false });
      mapError(error);
      return (data || []).map(mapRevision);
    },

    async getRevision(cvId, revisionId) {
      await actor();
      const { data, error } = await client.rpc("get_cv_revision_snapshot", {
        p_cv_id: cvId,
        p_revision_id: revisionId,
      });
      mapError(error);
      if (!data) throw new CvWorkspaceError("not-found", "CV Revision not found.");
      return data;
    },

    async listEditingSessions(cvId) {
      const user = await actor();
      const { data, error } = await client
        .from("cv_editing_sessions")
        .select("id, cv_id, owner_id, base_revision_id, status, optimistic_version, working_name, working_theme_id, working_profile, working_summary, working_summary_provenance, finished_revision_id, created_at, updated_at, finished_at")
        .eq("cv_id", cvId)
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false });
      mapError(error);
      return (data || []).map((row) => mapEditingSession(row));
    },

    getEditingSession: fetchEditingSession,

    async createCvEditingSession(input) {
      await actor();
      const draft = normalizeDraft(input);
      const { data: id, error } = await client.rpc("create_cv_with_editing_session", {
        p_state: {
          name: draft.name,
          themeId: draft.themeId,
          profile: draft.profile,
          summary: draft.summary,
          summaryProvenance: draft.summaryProvenance,
          selections: draft.selections,
        },
      });
      mapError(error);
      return fetchEditingSession(id);
    },

    async startEditingSession(cvId, baseRevisionId = null) {
      await actor();
      const { data: id, error } = await client.rpc("start_cv_editing_session", {
        p_cv_id: cvId,
        p_base_revision_id: baseRevisionId,
      });
      mapError(error);
      return fetchEditingSession(id);
    },

    async saveEditingSession(input) {
      await actor();
      const draft = normalizeDraft(input);
      const { data: id, error } = await client.rpc("save_cv_editing_session", {
        p_session_id: input.id,
        p_expected_version: input.optimisticVersion,
        p_name: draft.name,
        p_theme_id: draft.themeId,
        p_profile: draft.profile,
        p_summary: draft.summary || null,
        p_summary_provenance: draft.summaryProvenance,
        p_selections: serializeSelections(draft.selections),
      });
      mapError(error);
      return fetchEditingSession(id);
    },

    async finishEditingSession(id, expectedVersion) {
      await actor();
      const { error } = await client.rpc("finish_cv_editing_session", {
        p_session_id: id,
        p_expected_version: expectedVersion,
      });
      mapError(error);
      return fetchEditingSession(id);
    },

    async createChangeProposal(input) {
      await actor();
      const content = ["edit_content", "replace_working_state"].includes(input.operationType);
      const lifecycle = !content;
      const publication = ["publish_revision", "withdraw_publication"].includes(input.operationType);
      let rpcName;
      let params;
      if (publication) {
        rpcName = "create_cv_publication_proposal";
        params = { p_schema_version: input.schemaVersion, p_operation: input.operations[0] };
      } else if (input.operationType === "edit_content") {
        rpcName = "create_cv_content_change_proposal";
        params = {
          p_schema_version: input.schemaVersion,
          p_target_session_id: input.target.id,
          p_base_optimistic_version: input.baseOptimisticVersion,
          p_normalized_operations: input.operations,
        };
      } else if (lifecycle) {
        rpcName = "create_cv_lifecycle_proposal";
        params = { p_schema_version: input.schemaVersion, p_operation: input.operations[0] };
      } else {
        rpcName = "create_cv_change_proposal";
        params = {
          p_schema_version: input.schemaVersion,
          p_operation_type: input.operationType,
          p_target_session_id: input.target.id,
          p_base_optimistic_version: input.baseOptimisticVersion,
          p_normalized_operations: input.operations,
        };
      }
      const { data, error } = await client.rpc(rpcName, params);
      mapError(error);
      return mapChangeProposal(data);
    },

    getChangeProposal: fetchChangeProposal,

    async applyChangeProposal(id) {
      await actor();
      const current = await fetchChangeProposal(id);
      let rpcName;
      if (current.operationType === "edit_content") {
        rpcName = "apply_cv_content_change_proposal";
      } else if (current.operationType === "replace_working_state") {
        rpcName = "apply_cv_change_proposal";
      } else if (["publish_revision", "withdraw_publication"].includes(current.operationType)) {
        rpcName = "apply_cv_publication_proposal";
      } else {
        rpcName = "apply_cv_lifecycle_proposal";
      }
      const { data, error } = await client.rpc(rpcName, { p_proposal_id: id });
      mapError(error);
      const proposal = mapChangeProposal(data);
      if (proposal.status === "expired") {
        throw new CvWorkspaceError("proposal-expired", "Change Proposal has expired.");
      }
      if (proposal.status === "invalidated") {
        if (proposal.operationType === "edit_content" && proposal.result?.reason === "archived-cv") {
          throw new CvWorkspaceError(
            "invalid-lifecycle-transition",
            "Restore the CV before applying content changes.",
            proposal.result,
          );
        }
        if (proposal.operationType === "edit_content" && proposal.result?.blockId) {
          throw new CvWorkspaceError(
            "stale-block-version",
            "The CV Block has a newer current Block Version.",
            proposal.result,
          );
        }
        if (["publish_revision", "withdraw_publication"].includes(proposal.operationType)) {
          throw new CvWorkspaceError(
            "stale-proposal",
            "Publication changed after this Change Proposal was reviewed.",
            proposal.result || undefined,
          );
        }
        const target = proposal.result?.target;
        const context = target
          ? {
              target: mapEditingSession(
                target,
                (target.selections || []).map(mapEditingSessionSelection),
              ),
            }
          : proposal.result || undefined;
        throw new CvWorkspaceError(
          "stale-proposal",
          "Change Proposal is based on stale Editing Session state.",
          context,
        );
      }
      return proposal;
    },

    async discardChangeProposal(id) {
      await actor();
      const { data, error } = await client.rpc("discard_cv_change_proposal", {
        p_proposal_id: id,
      });
      mapError(error);
      return mapChangeProposal(data);
    },

    async publish() {
      throw new CvWorkspaceError("explicit-apply-required", "Select an exact CV Revision and apply its publication Change Proposal.");
    },

    async unpublish() {
      throw new CvWorkspaceError("explicit-apply-required", "Withdraw publication through a reviewed Change Proposal.");
    },

    async getPublished(slug) {
      const { data, error } = await client.rpc("get_published_cv", {
        p_slug: slug,
      });
      mapError(error);
      return data ? normalizeDraft(data) : null;
    },
  };
}
