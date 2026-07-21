import { normalizeDraft, normalizeSlug } from "./cvDraft";

export class CvWorkspaceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CvWorkspaceError";
    this.code = code;
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

    async open(id) {
      const cv = await repository.get(id);
      if (!cv) throw new CvWorkspaceError("not-found", "CV not found.");
      return normalizeDraft(cv);
    },

    async save(input) {
      const draft = normalizeDraft(input);
      if (!draft.name || draft.name === "Untitled CV") {
        throw new CvWorkspaceError("invalid-name", "Enter a name for this CV.");
      }
      return repository.save(draft);
    },

    async preview(id) {
      const cv = await this.open(id);
      return { ...cv, preview: true };
    },

    async publish(id, requestedSlug) {
      const cv = await this.open(id);
      const slug = normalizeSlug(requestedSlug || cv.slug || cv.name);
      if (!slug) throw new CvWorkspaceError("invalid-slug", "Enter a valid public slug.");
      return repository.publish(id, slug);
    },

    unpublish: (id) => repository.unpublish(id),

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
