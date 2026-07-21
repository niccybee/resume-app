import { normalizeDraft, normalizeSlug } from "./cvDraft";
import { exportCvRevision } from "./compositionAdapterRegistry";
import { LIFECYCLE_CHANGE_PROPOSAL_OPERATION_TYPES } from "./changeProposal";

export class CvWorkspaceError extends Error {
  constructor(code, message, context = undefined) {
    super(message);
    this.name = "CvWorkspaceError";
    this.code = code;
    if (context !== undefined) this.context = context;
  }
}

export function createCvWorkspace({ repository, summaryGenerator } = {}) {
  if (!repository) throw new CvWorkspaceError("missing-repository", "A CV repository is required.");

  function normalizeEditingSession(input) {
    const draft = normalizeDraft({ ...input, id: input.cvId });
    return {
      ...draft,
      id: input.id,
      cvId: input.cvId,
      baseRevisionId: input.baseRevisionId,
      optimisticVersion: input.optimisticVersion,
      status: input.status,
      finishedRevisionId: input.finishedRevisionId || null,
      createdAt: input.createdAt || null,
      updatedAt: input.updatedAt || null,
      finishedAt: input.finishedAt || null,
    };
  }

  function normalizeProposalOperations(operations) {
    if (!Array.isArray(operations) || operations.length !== 1) {
      throw new CvWorkspaceError(
        "validation-failed",
        "A Change Proposal requires exactly one supported operation.",
      );
    }
    const [operation] = operations;
    if (operation?.type !== "replace_working_state" || !operation.value) {
      throw new CvWorkspaceError(
        "validation-failed",
        "Unsupported Change Proposal operation.",
      );
    }
    const value = normalizeEditingSession({
      ...operation.value,
      id: operation.value.id || operation.value.sessionId,
      cvId: operation.value.cvId,
    });
    if (!value.name || value.name === "Untitled CV") {
      throw new CvWorkspaceError("validation-failed", "Enter a name for this CV.");
    }
    return [{
      type: "replace_working_state",
      value: {
        name: value.name,
        themeId: value.themeId,
        profile: value.profile,
        summary: value.summary,
        summaryProvenance: value.summaryProvenance,
        selections: value.selections,
      },
    }];
  }

  async function revisionNumbers(cvId) {
    const revisions = await repository.listRevisions(cvId);
    return new Map(revisions.map((revision) => [revision.id, revision.number]));
  }

  async function decorateEditingSession(input) {
    const session = normalizeEditingSession(input);
    const numberById = await revisionNumbers(session.cvId);
    return {
      ...session,
      baseRevisionNumber: numberById.get(session.baseRevisionId) || null,
      revisionNumber: session.finishedRevisionId
        ? numberById.get(session.finishedRevisionId) || null
        : null,
    };
  }

  return {
    list: () => repository.list(),

    async history(id) {
      const revisions = await repository.listRevisions(id);
      const numberById = new Map(revisions.map((revision) => [revision.id, revision.number]));
      return revisions.map((revision) => ({
        ...revision,
        baseRevisionNumber: revision.baseRevisionId
          ? numberById.get(revision.baseRevisionId) || null
          : null,
      }));
    },

    revision: (cvId, revisionId) => repository.getRevision(cvId, revisionId),

    async exportRevision(cvId, revisionId, options = {}) {
      const revision = await repository.getRevision(cvId, revisionId);
      return exportCvRevision({
        revision,
        adapter: options.adapter,
        adapterVersion: options.adapterVersion,
      });
    },

    async editingSessions(cvId) {
      const sessions = await repository.listEditingSessions(cvId);
      const numberById = await revisionNumbers(cvId);
      return sessions.map((input) => {
        const session = normalizeEditingSession(input);
        return {
          ...session,
          baseRevisionNumber: numberById.get(session.baseRevisionId) || null,
          revisionNumber: session.finishedRevisionId
            ? numberById.get(session.finishedRevisionId) || null
            : null,
        };
      });
    },

    async createCvEditingSession(input) {
      const draft = normalizeDraft(input);
      if (!draft.name || draft.name === "Untitled CV") {
        throw new CvWorkspaceError("invalid-name", "Enter a name for this CV.");
      }
      return decorateEditingSession(await repository.createCvEditingSession(draft));
    },

    async startEditingSession(cvId, baseRevisionId = null) {
      return decorateEditingSession(
        await repository.startEditingSession(cvId, baseRevisionId),
      );
    },

    async resumeEditingSession(sessionId) {
      const session = await repository.getEditingSession(sessionId);
      if (!session) {
        throw new CvWorkspaceError("not-found", "Editing Session not found.");
      }
      return decorateEditingSession(session);
    },

    async saveEditingSession(input) {
      const session = normalizeEditingSession(input);
      if (!session.name || session.name === "Untitled CV") {
        throw new CvWorkspaceError("invalid-name", "Enter a name for this CV.");
      }
      return decorateEditingSession(
        await repository.saveEditingSession(session),
      );
    },

    async finishEditingSession(sessionId, expectedVersion) {
      return decorateEditingSession(
        await repository.finishEditingSession(sessionId, expectedVersion),
      );
    },

    async proposeEditingSessionChange(input) {
      if (!input?.sessionId || !Number.isInteger(input.baseOptimisticVersion)) {
        throw new CvWorkspaceError(
          "validation-failed",
          "A target Editing Session and base optimistic version are required.",
        );
      }
      const target = await repository.getEditingSession(input.sessionId);
      if (!target) throw new CvWorkspaceError("not-found", "Editing Session not found.");
      const operations = normalizeProposalOperations(input.operations);
      return repository.createChangeProposal({
        schemaVersion: "1",
        operationType: "replace_working_state",
        target: { type: "editing_session", id: target.id, cvId: target.cvId },
        baseOptimisticVersion: input.baseOptimisticVersion,
        operations,
      });
    },

    async proposeLifecycleChange(input) {
      const operation = input?.operation;
      const supported = new Set(LIFECYCLE_CHANGE_PROPOSAL_OPERATION_TYPES);
      if (!supported.has(operation?.type)) {
        throw new CvWorkspaceError("validation-failed", "Unsupported lifecycle Change Proposal operation.");
      }
      if (operation.type === "publish_revision") {
        if (operation.target?.type !== "cv_revision" || !operation.target.id || !operation.target.cvId) {
          throw new CvWorkspaceError("validation-failed", "Publishing requires an exact CV Revision target.");
        }
        const slug = normalizeSlug(operation.slug);
        if (!slug) throw new CvWorkspaceError("invalid-slug", "Enter a valid public slug.");
        operation.slug = slug;
      } else if (operation.type === "withdraw_publication") {
        if (operation.target?.type !== "cv" || !operation.target.id) {
          throw new CvWorkspaceError("validation-failed", "Withdrawing publication requires a CV target.");
        }
      } else if (operation.type.startsWith("copy_")) {
        if (!operation.source?.id || !["editing_session", "cv_revision"].includes(operation.source.type)) {
          throw new CvWorkspaceError("validation-failed", "A CV Revision or Editing Session source is required.");
        }
        if (operation.type === "copy_for_new_role" && !String(operation.name || "").trim()) {
          throw new CvWorkspaceError("validation-failed", "Enter a name for the new role-focused CV.");
        }
      } else if (!operation.target?.id) {
        throw new CvWorkspaceError("validation-failed", "A lifecycle target is required.");
      }
      if (operation.type.endsWith("editing_session") && operation.target?.type !== "editing_session") {
        throw new CvWorkspaceError("validation-failed", "Editing Session lifecycle operations require an Editing Session target.");
      }
      const sessionSource = operation.source?.type === "editing_session";
      const sessionTarget = operation.target?.type === "editing_session";
      if ((sessionSource || sessionTarget) && !Number.isInteger(operation.baseOptimisticVersion)) {
        throw new CvWorkspaceError("validation-failed", "An Editing Session base optimistic version is required.");
      }
      if (["archive_cv", "restore_cv", "withdraw_publication"].includes(operation.type) && operation.target?.type !== "cv") {
        throw new CvWorkspaceError("validation-failed", "CV lifecycle operations require a CV target.");
      }
      return repository.createChangeProposal({
        schemaVersion: "1",
        operationType: operation.type,
        target: operation.target || operation.source,
        baseOptimisticVersion: operation.baseOptimisticVersion ?? null,
        operations: [{ ...operation, ...(operation.name ? { name: String(operation.name).trim() } : {}) }],
      });
    },

    getChangeProposal: (id) => repository.getChangeProposal(id),
    applyChangeProposal: (id) => repository.applyChangeProposal(id),
    discardChangeProposal: (id) => repository.discardChangeProposal(id),

    async open(id) {
      const cv = await repository.get(id);
      if (!cv) throw new CvWorkspaceError("not-found", "CV not found.");
      return normalizeDraft(cv);
    },

    async preview(id) {
      const cv = await this.open(id);
      const [latest] = await repository.listRevisions(id);
      if (!latest) return { ...cv, preview: true };
      const revision = await repository.getRevision(id, latest.id);
      return { ...normalizeDraft({ ...cv, ...revision, id: cv.id }), preview: true };
    },

    async publish(id, requestedSlug) {
      const cv = await this.open(id);
      const slug = normalizeSlug(requestedSlug || cv.slug || cv.name);
      if (!slug) throw new CvWorkspaceError("invalid-slug", "Enter a valid public slug.");
      if (cv.status === "archived") throw new CvWorkspaceError("invalid-lifecycle-transition", "Restore the CV before publishing it.");
      throw new CvWorkspaceError("explicit-apply-required", "Select an exact CV Revision and apply its publication Change Proposal.");
    },

    async unpublish(id) {
      const cv = await this.open(id);
      if (cv.status === "archived") throw new CvWorkspaceError("invalid-lifecycle-transition", "Restore the CV before changing publication.");
      throw new CvWorkspaceError("explicit-apply-required", "Withdraw publication through a reviewed Change Proposal.");
    },

    async getPublic(slug) {
      const normalized = normalizeSlug(slug);
      if (!normalized) return null;
      return repository.getPublished(normalized);
    },

    async suggestSummary(draft, instruction) {
      if (!summaryGenerator?.suggest) {
        throw new CvWorkspaceError("generator-unavailable", "Summary generation is not configured.");
      }
      const text = String(instruction || "").trim();
      if (!text) throw new CvWorkspaceError("invalid-instruction", "Add a summary instruction.");
      const proposal = await summaryGenerator.suggest({ draft: normalizeDraft(draft), instruction: text });
      return {
        text: proposal.text,
        provenance: {
          type: "ai",
          provider: proposal.provider || summaryGenerator.name || "unknown",
          ...(proposal.model ? { model: proposal.model } : {}),
          instruction: text,
          createdAt: proposal.createdAt || new Date().toISOString(),
        },
      };
    },

    acceptSummary(draft, proposal) {
      return normalizeDraft({
        ...draft,
        summary: proposal.text,
        summaryProvenance: proposal.provenance,
      });
    },
  };
}
