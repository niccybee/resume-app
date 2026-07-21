import { normalizeDraft } from "./cvDraft";
import { CvWorkspaceError } from "./createCvWorkspace";

function copy(value) {
  return structuredClone(value);
}

export function createMemoryCvRepository(initial = []) {
  const records = new Map(initial.map((item) => [item.id, normalizeDraft(item)]));
  const revisions = new Map(initial
    .filter((item) => item.id)
    .map((item) => {
      const snapshot = normalizeDraft(item);
      return [item.id, [{
        id: `${item.id}-revision-1`,
        cvId: item.id,
        number: 1,
        baseRevisionId: null,
        themeId: snapshot.themeId,
        profile: snapshot.profile,
        summary: snapshot.summary,
        summaryProvenance: snapshot.summaryProvenance,
        selections: snapshot.selections,
        createdAt: item.createdAt || null,
      }]];
    }));
  const editingSessions = new Map();
  let sequence = initial.length;
  let sessionSequence = 0;

  function session(id) {
    const value = editingSessions.get(id);
    if (!value) throw new CvWorkspaceError("not-found", "Editing Session not found.");
    return value;
  }

  return {
    async list() {
      return [...records.values()].map(copy);
    },
    async get(id) {
      const value = records.get(id);
      return value ? copy(value) : null;
    },
    async listRevisions(id) {
      return copy([...(revisions.get(id) || [])]
        .sort((a, b) => b.number - a.number)
        .map(({ selections, ...revision }) => revision));
    },
    async listEditingSessions(cvId) {
      return copy([...editingSessions.values()].filter((item) => item.cvId === cvId));
    },
    async getEditingSession(id) {
      const value = editingSessions.get(id);
      return value ? copy(value) : null;
    },
    async startEditingSession(cvId, requestedBaseRevisionId = null) {
      const document = records.get(cvId);
      if (!document) throw new CvWorkspaceError("not-found", "CV not found.");
      const history = revisions.get(cvId) || [];
      if (!history.length && !requestedBaseRevisionId) {
        history.push({
          id: `${cvId}-revision-1`,
          cvId,
          number: 1,
          baseRevisionId: null,
          themeId: document.themeId,
          profile: copy(document.profile),
          summary: document.summary,
          summaryProvenance: copy(document.summaryProvenance),
          selections: copy(document.selections),
          createdAt: new Date().toISOString(),
        });
        revisions.set(cvId, history);
      }
      const base = requestedBaseRevisionId
        ? history.find((item) => item.id === requestedBaseRevisionId)
        : [...history].sort((a, b) => b.number - a.number)[0];
      if (!base) {
        throw new CvWorkspaceError("not-found", "Base CV Revision not found.");
      }
      const now = new Date().toISOString();
      const value = {
        id: `session-${++sessionSequence}`,
        cvId,
        baseRevisionId: base.id,
        status: "open",
        optimisticVersion: 1,
        finishedRevisionId: null,
        name: document.name,
        themeId: base.themeId,
        profile: copy(base.profile),
        summary: base.summary,
        summaryProvenance: copy(base.summaryProvenance),
        selections: copy(base.selections || []),
        createdAt: now,
        updatedAt: now,
        finishedAt: null,
      };
      editingSessions.set(value.id, value);
      return copy(value);
    },
    async saveEditingSession(input) {
      const current = session(input.id);
      if (current.status !== "open") {
        throw new CvWorkspaceError("session-finished", "Editing Session is not open.");
      }
      if (current.optimisticVersion !== input.optimisticVersion) {
        throw new CvWorkspaceError(
          "session-conflict",
          "Editing Session changed elsewhere. Resume it before trying again.",
        );
      }
      const draft = normalizeDraft({ ...input, id: current.cvId });
      const saved = {
        ...current,
        name: draft.name,
        themeId: draft.themeId,
        profile: draft.profile,
        summary: draft.summary,
        summaryProvenance: draft.summaryProvenance,
        selections: draft.selections,
        optimisticVersion: current.optimisticVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      editingSessions.set(saved.id, saved);
      return copy(saved);
    },
    async finishEditingSession(id, expectedVersion) {
      const current = session(id);
      if (current.status === "finished") return copy(current);
      if (current.status !== "open") {
        throw new CvWorkspaceError("session-finished", "Editing Session is not open.");
      }
      if (current.optimisticVersion !== expectedVersion) {
        throw new CvWorkspaceError(
          "session-conflict",
          "Editing Session changed elsewhere. Resume it before trying again.",
        );
      }
      const history = revisions.get(current.cvId) || [];
      const number = Math.max(0, ...history.map((item) => item.number)) + 1;
      const revision = {
        id: `${current.cvId}-revision-${number}`,
        cvId: current.cvId,
        number,
        baseRevisionId: current.baseRevisionId,
        themeId: current.themeId,
        profile: copy(current.profile),
        summary: current.summary,
        summaryProvenance: copy(current.summaryProvenance),
        selections: copy(current.selections),
        createdAt: new Date().toISOString(),
      };
      history.push(revision);
      revisions.set(current.cvId, history);
      const finished = {
        ...current,
        status: "finished",
        finishedRevisionId: revision.id,
        optimisticVersion: current.optimisticVersion + 1,
        updatedAt: revision.createdAt,
        finishedAt: revision.createdAt,
      };
      editingSessions.set(id, finished);
      return copy(finished);
    },
    async save(input) {
      const draft = normalizeDraft(input);
      const id = draft.id || `cv-${++sequence}`;
      const saved = { ...draft, id };
      records.set(id, saved);
      return copy(saved);
    },
    async publish(id, slug) {
      const current = records.get(id);
      if (!current) throw new CvWorkspaceError("not-found", "CV not found.");
      if ([...records.values()].some((cv) => cv.id !== id && cv.slug === slug)) {
        throw new CvWorkspaceError("slug-conflict", "That public slug is already in use.");
      }
      const saved = {
        ...current,
        slug,
        status: "published",
        publishedAt: new Date().toISOString(),
      };
      records.set(id, saved);
      return copy(saved);
    },
    async unpublish(id) {
      const current = records.get(id);
      if (!current) throw new CvWorkspaceError("not-found", "CV not found.");
      const saved = { ...current, status: "draft", publishedAt: null };
      records.set(id, saved);
      return copy(saved);
    },
    async getPublished(slug) {
      const value = [...records.values()].find(
        (cv) => cv.slug === slug && cv.status === "published",
      );
      return value ? copy(value) : null;
    },
  };
}
