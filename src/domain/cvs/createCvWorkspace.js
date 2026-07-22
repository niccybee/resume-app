import { normalizeDraft, normalizeSlug } from "./cvDraft";
import { exportCvRevision } from "./compositionAdapterRegistry";
import { isSupportedBlockDate, validateBlockContent } from "../blocks/blockSchemaRegistry";
import { createEmploymentContext } from "../employment/occasion";
import {
  CONTENT_CHANGE_OPERATION_TYPES,
  LIFECYCLE_CHANGE_PROPOSAL_OPERATION_TYPES,
} from "./changeProposal";

export class CvWorkspaceError extends Error {
  constructor(code, message, context = undefined) {
    super(message);
    this.name = "CvWorkspaceError";
    this.code = code;
    if (context !== undefined) this.context = context;
  }
}

const SIDEBAR_SECTION_BY_BLOCK_KIND = Object.freeze({
  skill: "skills",
  certification: "certifications",
  education: "education",
  interest: "interests",
});

export function createCvWorkspace({ repository, blockLibrary, summaryGenerator } = {}) {
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

  async function normalizeContentOperations(operations) {
    if (!Array.isArray(operations) || operations.length === 0 || operations.length > 50) {
      throw new CvWorkspaceError("validation-failed", "A Change Proposal requires between one and 50 supported operations.");
    }
    const supported = new Set(CONTENT_CHANGE_OPERATION_TYPES);
    if (operations.some((operation) => !supported.has(operation?.type))) {
      throw new CvWorkspaceError("validation-failed", "Unsupported content Change Proposal operation.");
    }
    if (operations.filter((operation) => operation.type === "replace_working_state").length > 1) {
      throw new CvWorkspaceError("validation-failed", "A Change Proposal can replace the Working Composition only once.");
    }
    const appendedBlockIds = new Set();
    const normalized = [];
    for (const operation of operations) {
      if (operation.type === "replace_working_state") {
        normalized.push(normalizeProposalOperations([operation])[0]);
        continue;
      }
      if (!blockLibrary) {
        throw new CvWorkspaceError("validation-failed", "CV Block changes require the Block Library boundary.");
      }
      if (!operation.blockId || !operation.basedOnVersionId) {
        throw new CvWorkspaceError("validation-failed", "Appending a Block Version requires a CV Block and exact base Block Version.");
      }
      if (appendedBlockIds.has(operation.blockId)) {
        throw new CvWorkspaceError("validation-failed", "A proposal can append at most one Version for each CV Block.");
      }
      appendedBlockIds.add(operation.blockId);
      const block = await blockLibrary.getBlock(operation.blockId);
      if (block.status !== "active") {
        throw new CvWorkspaceError(
          "invalid-lifecycle-transition",
          "Restore the CV Block before appending a Block Version.",
          { blockId: block.id },
        );
      }
      if (block.currentVersion?.id !== operation.basedOnVersionId) {
        throw new CvWorkspaceError(
          "stale-block-version",
          "The CV Block has a newer current Block Version.",
          { blockId: block.id, currentVersionId: block.currentVersion?.id || null },
        );
      }
      const schemaVersion = operation.schemaVersion || "1";
      try {
        validateBlockContent({ kind: block.kind, schemaVersion, content: operation.content });
      } catch (cause) {
        throw new CvWorkspaceError(
          cause?.code === "unsupported-schema-version" ? "unsupported-schema" : "validation-failed",
          cause?.message || "CV Block content is invalid.",
        );
      }
      normalized.push({
        type: "append_block_version",
        blockId: block.id,
        kind: block.kind,
        basedOnVersionId: operation.basedOnVersionId,
        schemaVersion,
        content: structuredClone(operation.content),
        source: structuredClone(operation.source || { type: "human" }),
      });
    }
    return normalized;
  }

  async function proposeContentChanges(input) {
    if (input?.schemaVersion !== "1") {
      throw new CvWorkspaceError("unsupported-schema", "Unsupported Change Proposal schema version.");
    }
    if (input?.target?.type !== "editing_session" || !input.target.id
      || !Number.isInteger(input.baseVersion) || input.baseVersion < 1) {
      throw new CvWorkspaceError("validation-failed", "An Editing Session target and base Working Composition version are required.");
    }
    const target = await repository.getEditingSession(input.target.id);
    if (!target) throw new CvWorkspaceError("not-found", "Editing Session not found.");
    const operations = await normalizeContentOperations(input.operations);
    return repository.createChangeProposal({
      schemaVersion: "1",
      operationType: "edit_content",
      target: { type: "editing_session", id: target.id, cvId: target.cvId },
      baseOptimisticVersion: input.baseVersion,
      operations,
    });
  }

  async function revisionNumbers(cvId, revisionIds) {
    const ids = [...new Set((revisionIds || []).filter(Boolean))];
    if (ids.length === 0) return new Map();
    const revisions = await repository.listRevisions(cvId, { ids, limit: ids.length });
    return new Map(revisions.map((revision) => [revision.id, revision.number]));
  }

  async function decorateEditingSession(input) {
    const session = normalizeEditingSession(input);
    const numberById = await revisionNumbers(session.cvId, [
      session.baseRevisionId,
      session.finishedRevisionId,
    ]);
    return {
      ...session,
      baseRevisionNumber: numberById.get(session.baseRevisionId) || null,
      revisionNumber: session.finishedRevisionId
        ? numberById.get(session.finishedRevisionId) || null
        : null,
    };
  }

  return {
    list: (options) => repository.list(options),
    get: (id) => repository.get(id),

    async history(id, options) {
      const revisions = await repository.listRevisions(id, options);
      const numberById = new Map(revisions.map((revision) => [revision.id, revision.number]));
      const missingBaseIds = [...new Set(revisions
        .map((revision) => revision.baseRevisionId)
        .filter((baseRevisionId) => baseRevisionId && !numberById.has(baseRevisionId)))];
      if (missingBaseIds.length) {
        const bases = await repository.listRevisions(id, {
          ids: missingBaseIds,
          limit: missingBaseIds.length,
        });
        bases.forEach((revision) => numberById.set(revision.id, revision.number));
      }
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

    async editingSessions(cvId, options) {
      const sessions = await repository.listEditingSessions(cvId, options);
      const normalizedSessions = sessions.map(normalizeEditingSession);
      const numberById = await revisionNumbers(cvId, normalizedSessions.flatMap((session) => [
        session.baseRevisionId,
        session.finishedRevisionId,
      ]));
      return normalizedSessions.map((session) => {
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
      return proposeContentChanges({
        schemaVersion: "1",
        target: { type: "editing_session", id: input.sessionId },
        baseVersion: input.baseOptimisticVersion,
        operations: input.operations,
      });
    },

    proposeContentChanges,

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
      } else if (operation.type === "create_cv_block") {
        if (!String(operation.title || "").trim()) {
          throw new CvWorkspaceError("validation-failed", "Enter a title for the new CV Block.");
        }
        const schemaVersion = operation.schemaVersion || "1";
        try {
          validateBlockContent({ kind: operation.kind, schemaVersion, content: operation.content });
        } catch (cause) {
          throw new CvWorkspaceError(
            cause?.code === "unsupported-schema-version" ? "unsupported-schema" : "validation-failed",
            cause?.message || "CV Block content is invalid.",
          );
        }
        operation.title = String(operation.title).trim();
        operation.schemaVersion = schemaVersion;
        operation.target = { type: "cv_block", id: crypto.randomUUID() };
        if (operation.kind === "experience") {
          const occasion = operation.employmentOccasion;
          if (!String(occasion?.employer || "").trim()
            || !String(occasion?.role || "").trim()
            || !isSupportedBlockDate(occasion?.startDate)
            || (occasion?.endDate !== undefined && !isSupportedBlockDate(occasion.endDate))) {
            throw new CvWorkspaceError(
              "validation-failed",
              "An Experience Block requires an Employment Occasion with employer, role, and valid dates.",
            );
          }
          operation.contexts = [createEmploymentContext({
            employer: occasion.employer.trim(),
            role: occasion.role.trim(),
            startDate: occasion.startDate,
            ...(occasion.endDate ? { endDate: occasion.endDate } : {}),
          })];
        } else {
          if (operation.employmentOccasion !== undefined) {
            throw new CvWorkspaceError("validation-failed", "Only Experience Blocks use an Employment Occasion.");
          }
          operation.contexts = [{
            type: "sidebar",
            key: SIDEBAR_SECTION_BY_BLOCK_KIND[operation.kind],
            label: operation.title,
            metadata: {},
          }];
        }
      } else if (!operation.target?.id) {
        throw new CvWorkspaceError("validation-failed", "A lifecycle target is required.");
      }
      if (operation.type === "start_editing_session") {
        if (operation.target?.type !== "cv") {
          throw new CvWorkspaceError("validation-failed", "Starting an Editing Session requires a CV target.");
        }
        if (operation.baseRevisionId != null && typeof operation.baseRevisionId !== "string") {
          throw new CvWorkspaceError("validation-failed", "The base CV Revision must be an exact identifier.");
        }
      }
      if (["resume_editing_session", "finish_editing_session", "archive_editing_session", "restore_editing_session"].includes(operation.type)
        && operation.target?.type !== "editing_session") {
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
      if (["archive_cv_block", "restore_cv_block", "duplicate_cv_block", "delete_cv_block"].includes(operation.type)) {
        if (operation.target?.type !== "cv_block" || !operation.baseVersionId) {
          throw new CvWorkspaceError("validation-failed", "CV Block lifecycle operations require a CV Block and exact base Block Version.");
        }
        if (!blockLibrary) {
          throw new CvWorkspaceError("validation-failed", "CV Block lifecycle changes require the Block Library boundary.");
        }
        const block = await blockLibrary.getBlock(operation.target.id);
        if (block.currentVersion?.id !== operation.baseVersionId) {
          throw new CvWorkspaceError("stale-block-version", "The CV Block has a newer current Block Version.", {
            blockId: block.id,
            currentVersionId: block.currentVersion?.id || null,
          });
        }
        if (["archive_cv_block", "restore_cv_block"].includes(operation.type)) {
          const expectedStatus = operation.type === "archive_cv_block" ? "active" : "archived";
          if (block.status !== expectedStatus) {
            throw new CvWorkspaceError("invalid-lifecycle-transition", "CV Block cannot make that lifecycle transition.");
          }
        }
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
