import { normalizeDraft } from "./cvDraft";
import { CvWorkspaceError } from "./createCvWorkspace";
import { nextChangeProposalActions } from "./changeProposal";

function copy(value) {
  return structuredClone(value);
}

function lineage(item) {
  return {
    ...normalizeDraft({
      id: item.id,
      name: item.name,
      slug: item.slug,
      status: item.status,
      publishedAt: item.publishedAt,
      publishedRevisionId: item.publishedRevisionId,
    }),
    ...(item.statusBeforeArchive ? { statusBeforeArchive: item.statusBeforeArchive } : {}),
  };
}

export function createMemoryCvRepository(initial = [], { clock = () => new Date() } = {}) {
  const records = new Map(initial.map((item) => [item.id, lineage(item)]));
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
  const changeProposals = new Map();
  let sequence = initial.length;
  let sessionSequence = 0;
  let proposalSequence = 0;

  function nowIso() {
    return clock().toISOString();
  }

  function session(id) {
    const value = editingSessions.get(id);
    if (!value) throw new CvWorkspaceError("not-found", "Editing Session not found.");
    return value;
  }

  function proposal(id) {
    const value = changeProposals.get(id);
    if (!value) throw new CvWorkspaceError("not-found", "Change Proposal not found.");
    return value;
  }

  function invalidateForArchivedParent(current, target) {
    const context = { target: copy(target), reason: "archived-cv" };
    changeProposals.set(current.id, {
      ...current,
      status: "invalidated",
      result: context,
      nextActions: nextChangeProposalActions("invalidated"),
    });
    throw new CvWorkspaceError(
      "invalid-lifecycle-transition",
      "Restore the CV before changing its Editing Sessions.",
      context,
    );
  }

  function proposalDiff(before, after) {
    const fields = [];
    for (const path of ["name", "themeId", "profile", "summary", "summaryProvenance"]) {
      if (JSON.stringify(before[path]) !== JSON.stringify(after[path])) {
        fields.push({ path, before: copy(before[path]), after: copy(after[path]) });
      }
    }
    const beforeByBlock = new Map(before.selections.map((item) => [item.blockId, item]));
    const afterByBlock = new Map(after.selections.map((item) => [item.blockId, item]));
    return {
      fields,
      composition: {
        added: copy(after.selections.filter((item) => !beforeByBlock.has(item.blockId))),
        removed: copy(before.selections.filter((item) => !afterByBlock.has(item.blockId))),
        replaced: copy(after.selections.filter((item) => {
          const previous = beforeByBlock.get(item.blockId);
          return previous && previous.versionId !== item.versionId;
        }).map((item) => ({ before: beforeByBlock.get(item.blockId), after: item }))),
        moved: copy(after.selections.filter((item) => {
          const previous = beforeByBlock.get(item.blockId);
          return previous && previous.versionId === item.versionId
            && (previous.section !== item.section || previous.order !== item.order);
        }).map((item) => ({ before: beforeByBlock.get(item.blockId), after: item }))),
        changed: copy(after.selections.filter((item) => {
          const previous = beforeByBlock.get(item.blockId);
          if (!previous || previous.versionId !== item.versionId) return false;
          const previousPresentation = { block: previous.block, group: previous.group };
          const nextPresentation = { block: item.block, group: item.group };
          return JSON.stringify(previousPresentation) !== JSON.stringify(nextPresentation);
        }).map((item) => ({ before: beforeByBlock.get(item.blockId), after: item }))),
      },
    };
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
    async getRevision(cvId, revisionId) {
      const revision = (revisions.get(cvId) || []).find((item) => item.id === revisionId);
      if (!revision) throw new CvWorkspaceError("not-found", "CV Revision not found.");
      return copy(revision);
    },
    async listEditingSessions(cvId) {
      return copy([...editingSessions.values()].filter((item) => item.cvId === cvId));
    },
    async getEditingSession(id) {
      const value = editingSessions.get(id);
      return value ? copy(value) : null;
    },
    async createCvEditingSession(input) {
      const draft = normalizeDraft(input);
      const cvId = `cv-${++sequence}`;
      records.set(cvId, normalizeDraft({ id: cvId, name: draft.name }));
      revisions.set(cvId, []);
      const now = nowIso();
      const created = {
        id: `session-${++sessionSequence}`,
        cvId,
        baseRevisionId: null,
        status: "open",
        optimisticVersion: 1,
        name: draft.name,
        themeId: draft.themeId,
        profile: copy(draft.profile),
        summary: draft.summary,
        summaryProvenance: copy(draft.summaryProvenance),
        selections: copy(draft.selections),
        finishedRevisionId: null,
        createdAt: now,
        updatedAt: now,
        finishedAt: null,
      };
      editingSessions.set(created.id, created);
      return copy(created);
    },
    async startEditingSession(cvId, requestedBaseRevisionId = null) {
      const document = records.get(cvId);
      if (!document) throw new CvWorkspaceError("not-found", "CV not found.");
      if (document.status === "archived") throw new CvWorkspaceError("invalid-lifecycle-transition", "Restore the CV before starting an Editing Session.");
      const history = revisions.get(cvId) || [];
      const base = requestedBaseRevisionId
        ? history.find((item) => item.id === requestedBaseRevisionId)
        : [...history].sort((a, b) => b.number - a.number)[0];
      if (requestedBaseRevisionId && !base) {
        throw new CvWorkspaceError("not-found", "Base CV Revision not found.");
      }
      const now = nowIso();
      const value = {
        id: `session-${++sessionSequence}`,
        cvId,
        baseRevisionId: base?.id || null,
        status: "open",
        optimisticVersion: 1,
        finishedRevisionId: null,
        name: document.name,
        themeId: base?.themeId || null,
        profile: copy(base?.profile || {}),
        summary: base?.summary || "",
        summaryProvenance: copy(base?.summaryProvenance || null),
        selections: copy(base?.selections || []),
        createdAt: now,
        updatedAt: now,
        finishedAt: null,
      };
      editingSessions.set(value.id, value);
      return copy(value);
    },
    async saveEditingSession(input) {
      const current = session(input.id);
      if (records.get(current.cvId)?.status === "archived") throw new CvWorkspaceError("invalid-lifecycle-transition", "Restore the CV before changing its Editing Sessions.");
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
        updatedAt: nowIso(),
      };
      editingSessions.set(saved.id, saved);
      return copy(saved);
    },
    async finishEditingSession(id, expectedVersion) {
      const current = session(id);
      if (records.get(current.cvId)?.status === "archived") throw new CvWorkspaceError("invalid-lifecycle-transition", "Restore the CV before finishing its Editing Sessions.");
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
        createdAt: nowIso(),
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
    async createChangeProposal(input) {
      if (input.operationType !== "replace_working_state") {
        const operation = input.operations[0];
        let source;
        let warnings = [];
        let diff = { lifecycle: { operation: operation.type, source: copy(input.target) } };
        if (operation.type === "publish_revision") {
          source = [...revisions.values()].flat().find((item) => item.id === operation.target.id && item.cvId === operation.target.cvId);
          if (!source) throw new CvWorkspaceError("not-found", "CV Revision not found.");
          const document = records.get(source.cvId);
          if (!document) throw new CvWorkspaceError("not-found", "CV not found.");
          if (document.status === "archived") throw new CvWorkspaceError("invalid-lifecycle-transition", "Restore the CV before publishing it.");
          if (document.slug && document.slug !== operation.slug) {
            throw new CvWorkspaceError("invalid-slug", "A published CV keeps its stable public slug.");
          }
          if ([...records.values()].some((cv) => cv.id !== document.id && cv.slug === operation.slug)) {
            throw new CvWorkspaceError("slug-conflict", "That public slug is already in use.");
          }
          const currentRevision = (revisions.get(document.id) || []).find((item) => item.id === document.publishedRevisionId);
          if (currentRevision && source.number < currentRevision.number) warnings = [`This rolls back the public CV to Revision ${source.number}.`];
          diff = { publication: {
            slug: document.slug || operation.slug,
            beforeStatus: document.status,
            beforeRevisionId: document.publishedRevisionId,
            afterRevisionId: source.id,
          } };
        } else if (operation.type === "withdraw_publication") {
          source = records.get(operation.target.id);
          if (!source) throw new CvWorkspaceError("not-found", "CV not found.");
          if (source.status !== "published") throw new CvWorkspaceError("invalid-lifecycle-transition", "CV is not currently published.");
          diff = { publication: {
            slug: source.slug,
            beforeStatus: source.status,
            beforeRevisionId: source.publishedRevisionId,
            afterRevisionId: null,
          } };
          warnings = ["Withdrawing publication immediately deactivates the public link without deleting its CV Revision."];
        } else if (operation.type.startsWith("copy_")) {
          if (operation.source.type === "editing_session") {
            source = session(operation.source.id);
            if (source.status !== "open" || source.optimisticVersion !== operation.baseOptimisticVersion) {
              throw new CvWorkspaceError("stale-proposal", "Copy source changed before proposal creation.", { target: copy(source) });
            }
          } else {
            source = [...revisions.values()].flat().find((item) => item.id === operation.source.id && item.cvId === operation.source.cvId);
            if (!source) throw new CvWorkspaceError("not-found", "Source CV Revision not found.");
          }
          if (operation.type === "copy_to_new_version" && records.get(source.cvId)?.status === "archived") {
            throw new CvWorkspaceError("invalid-lifecycle-transition", "Restore the CV before copying within its lineage.");
          }
        } else if (operation.target.type === "editing_session") {
          source = session(operation.target.id);
          if (records.get(source.cvId)?.status === "archived") {
            throw new CvWorkspaceError("invalid-lifecycle-transition", "Restore the CV before changing its Editing Sessions.");
          }
          const expectedStatus = operation.type === "archive_editing_session" ? "open" : "archived";
          if (source.status !== expectedStatus) throw new CvWorkspaceError("invalid-lifecycle-transition", `Editing Session cannot ${operation.type.startsWith("archive") ? "be archived" : "be restored"}.`);
          if (source.optimisticVersion !== operation.baseOptimisticVersion) {
            throw new CvWorkspaceError("stale-proposal", "Editing Session changed before proposal creation.", { target: copy(source) });
          }
        } else {
          source = records.get(operation.target.id);
          if (!source) throw new CvWorkspaceError("not-found", "CV not found.");
          const expectedStatus = operation.type === "archive_cv" ? ["draft", "published"] : ["archived"];
          if (!expectedStatus.includes(source.status)) throw new CvWorkspaceError("invalid-lifecycle-transition", "CV cannot make that lifecycle transition.");
        }
        const createdAt = nowIso();
        const value = {
          id: `proposal-${++proposalSequence}`,
          ...copy(input),
          target: copy(input.target),
          diff,
          warnings: operation.type === "archive_cv" && source.status === "published"
            ? ["Archiving this CV withdraws its active publication without changing shared CV Blocks."]
            : warnings,
          createdAt,
          expiresAt: new Date(clock().getTime() + 24 * 60 * 60 * 1000).toISOString(),
          status: "pending",
          result: null,
          nextActions: nextChangeProposalActions("pending"),
        };
        changeProposals.set(value.id, value);
        return copy(value);
      }
      const target = session(input.target.id);
      if (records.get(target.cvId)?.status === "archived") throw new CvWorkspaceError("invalid-lifecycle-transition", "Restore the CV before proposing Working Composition changes.");
      if (target.status !== "open") {
        throw new CvWorkspaceError("invalid-lifecycle-transition", "Editing Session is not open.");
      }
      if (target.optimisticVersion !== input.baseOptimisticVersion) {
        throw new CvWorkspaceError("stale-proposal", "Editing Session changed before the proposal was created.", {
          target: copy(target),
        });
      }
      const proposed = normalizeDraft({
        ...input.operations[0].value,
        id: target.cvId,
      });
      const createdAt = nowIso();
      const expiresAt = new Date(clock().getTime() + 24 * 60 * 60 * 1000).toISOString();
      const value = {
        id: `proposal-${++proposalSequence}`,
        ...copy(input),
        diff: proposalDiff(target, proposed),
        warnings: [],
        createdAt,
        expiresAt,
        status: "pending",
        result: null,
        nextActions: nextChangeProposalActions("pending"),
      };
      changeProposals.set(value.id, value);
      return copy(value);
    },
    async getChangeProposal(id) {
      return copy(proposal(id));
    },
    async discardChangeProposal(id) {
      const current = proposal(id);
      if (current.status === "discarded") return copy(current);
      if (current.status !== "pending") {
        throw new CvWorkspaceError("invalid-proposal-state", "Only a pending Change Proposal can be discarded.");
      }
      const discarded = { ...current, status: "discarded", nextActions: nextChangeProposalActions("discarded") };
      changeProposals.set(id, discarded);
      return copy(discarded);
    },
    async applyChangeProposal(id) {
      const current = proposal(id);
      if (current.status === "applied") return copy(current);
      if (current.status === "expired") {
        throw new CvWorkspaceError("proposal-expired", "Change Proposal has expired.");
      }
      if (current.status === "invalidated") {
        if (current.result?.reason === "archived-cv") {
          throw new CvWorkspaceError(
            "invalid-lifecycle-transition",
            "Restore the CV before changing its Editing Sessions.",
            current.result,
          );
        }
        throw new CvWorkspaceError("stale-proposal", "Change Proposal is based on stale Editing Session state.", current.result);
      }
      if (current.status !== "pending") {
        throw new CvWorkspaceError("invalid-proposal-state", "Only a pending Change Proposal can be applied.");
      }
      if (clock().getTime() > new Date(current.expiresAt).getTime()) {
        changeProposals.set(id, { ...current, status: "expired", nextActions: nextChangeProposalActions("expired") });
        throw new CvWorkspaceError("proposal-expired", "Change Proposal has expired.");
      }
      if (current.operationType !== "replace_working_state") {
        const operation = current.operations[0];
        let result;
        if (operation.type === "publish_revision") {
          const revision = [...revisions.values()].flat().find((item) => item.id === operation.target.id && item.cvId === operation.target.cvId);
          if (!revision) throw new CvWorkspaceError("not-found", "CV Revision not found.");
          const document = records.get(revision.cvId);
          if (!document) throw new CvWorkspaceError("not-found", "CV not found.");
          if (
            document.status !== current.diff.publication.beforeStatus
            || document.publishedRevisionId !== current.diff.publication.beforeRevisionId
          ) {
            const context = { target: copy(document) };
            changeProposals.set(id, { ...current, status: "invalidated", result: context, nextActions: [] });
            throw new CvWorkspaceError("stale-proposal", "Publication changed after proposal review.", context);
          }
          if (document.status === "archived") throw new CvWorkspaceError("invalid-lifecycle-transition", "Restore the CV before publishing it.");
          const stableSlug = document.slug || operation.slug;
          if (document.slug && document.slug !== operation.slug) throw new CvWorkspaceError("invalid-slug", "A published CV keeps its stable public slug.");
          if ([...records.values()].some((cv) => cv.id !== document.id && cv.slug === stableSlug)) {
            throw new CvWorkspaceError("slug-conflict", "That public slug is already in use.");
          }
          const saved = {
            ...document, slug: stableSlug, status: "published", publishedRevisionId: revision.id, publishedAt: nowIso(),
          };
          records.set(saved.id, saved);
          result = { cvId: saved.id, revisionId: revision.id, slug: stableSlug, status: "published" };
        } else if (operation.type === "withdraw_publication") {
          const document = records.get(operation.target.id);
          if (!document) throw new CvWorkspaceError("not-found", "CV not found.");
          if (document.status !== "published" || document.publishedRevisionId !== current.diff.publication.beforeRevisionId) {
            const context = { target: copy(document) };
            changeProposals.set(id, { ...current, status: "invalidated", result: context, nextActions: [] });
            throw new CvWorkspaceError("stale-proposal", "Publication changed after proposal review.", context);
          }
          const saved = { ...document, status: "draft", publishedAt: null };
          records.set(saved.id, saved);
          result = { cvId: saved.id, revisionId: saved.publishedRevisionId, slug: saved.slug, status: "draft" };
        } else if (operation.type.startsWith("copy_")) {
          let source;
          if (operation.source.type === "editing_session") {
            source = session(operation.source.id);
            if (source.status !== "open" || source.optimisticVersion !== operation.baseOptimisticVersion) {
              const context = { target: copy(source) };
              changeProposals.set(id, { ...current, status: "invalidated", result: context, nextActions: [] });
              throw new CvWorkspaceError("stale-proposal", "Copy source changed.", context);
            }
          } else {
            source = [...revisions.values()].flat().find((item) => item.id === operation.source.id && item.cvId === operation.source.cvId);
            if (!source) throw new CvWorkspaceError("not-found", "Source CV Revision not found.");
          }
          if (operation.type === "copy_to_new_version" && records.get(source.cvId)?.status === "archived") {
            invalidateForArchivedParent(current, source);
          }
          const now = nowIso();
          let cvId = source.cvId;
          let baseRevisionId = operation.source.type === "cv_revision" ? source.id : source.baseRevisionId;
          let name = operation.type === "copy_for_new_role" ? operation.name : records.get(cvId).name;
          if (operation.type === "copy_for_new_role") {
            cvId = `cv-${++sequence}`;
            baseRevisionId = null;
            records.set(cvId, normalizeDraft({ id: cvId, name, status: "draft", selections: [] }));
            revisions.set(cvId, []);
          }
          const copied = {
            id: `session-${++sessionSequence}`,
            cvId,
            baseRevisionId,
            copiedFromSessionId: operation.source.type === "editing_session" ? source.id : null,
            copyIntent: operation.type,
            status: "open",
            optimisticVersion: 1,
            finishedRevisionId: null,
            name,
            themeId: source.themeId,
            profile: copy(source.profile),
            summary: source.summary,
            summaryProvenance: copy(source.summaryProvenance),
            selections: copy(source.selections || []),
            createdAt: now,
            updatedAt: now,
            finishedAt: null,
          };
          editingSessions.set(copied.id, copied);
          result = { cvId, editingSessionId: copied.id, optimisticVersion: 1 };
        } else if (operation.target.type === "editing_session") {
          const target = session(operation.target.id);
          if (records.get(target.cvId)?.status === "archived") {
            invalidateForArchivedParent(current, target);
          }
          const expectedStatus = operation.type === "archive_editing_session" ? "open" : "archived";
          if (target.status !== expectedStatus || target.optimisticVersion !== operation.baseOptimisticVersion) {
            const context = { target: copy(target) };
            changeProposals.set(id, { ...current, status: "invalidated", result: context, nextActions: [] });
            throw new CvWorkspaceError("stale-proposal", "Editing Session changed.", context);
          }
          const saved = {
            ...target,
            status: operation.type === "archive_editing_session" ? "archived" : "open",
            optimisticVersion: target.optimisticVersion + 1,
            updatedAt: nowIso(),
          };
          editingSessions.set(saved.id, saved);
          result = { cvId: saved.cvId, editingSessionId: saved.id, optimisticVersion: saved.optimisticVersion };
        } else {
          const target = records.get(operation.target.id);
          if (!target) throw new CvWorkspaceError("not-found", "CV not found.");
          if (operation.type === "archive_cv" && !["draft", "published"].includes(target.status)) {
            throw new CvWorkspaceError("invalid-lifecycle-transition", "CV cannot be archived.");
          }
          if (operation.type === "restore_cv" && target.status !== "archived") {
            throw new CvWorkspaceError("invalid-lifecycle-transition", "CV cannot be restored.");
          }
          const saved = operation.type === "archive_cv"
            ? { ...target, statusBeforeArchive: target.status, status: "archived", publishedAt: null }
            : { ...target, status: target.statusBeforeArchive === "published" ? "draft" : (target.statusBeforeArchive || "draft"), statusBeforeArchive: null };
          records.set(saved.id, saved);
          result = { cvId: saved.id, status: saved.status };
        }
        const applied = { ...current, status: "applied", result, nextActions: nextChangeProposalActions("applied") };
        changeProposals.set(id, applied);
        return copy(applied);
      }
      const target = session(current.target.id);
      if (records.get(target.cvId)?.status === "archived") {
        invalidateForArchivedParent(current, target);
      }
      if (target.status !== "open" || target.optimisticVersion !== current.baseOptimisticVersion) {
        const result = { target: copy(target) };
        changeProposals.set(id, { ...current, status: "invalidated", result, nextActions: nextChangeProposalActions("invalidated") });
        throw new CvWorkspaceError("stale-proposal", "Change Proposal is based on stale Editing Session state.", {
          target: copy(target),
        });
      }
      const next = normalizeDraft({
        ...current.operations[0].value,
        id: target.cvId,
      });
      const saved = {
        ...target,
        name: next.name,
        themeId: next.themeId,
        profile: next.profile,
        summary: next.summary,
        summaryProvenance: next.summaryProvenance,
        selections: next.selections,
        optimisticVersion: target.optimisticVersion + 1,
        updatedAt: nowIso(),
      };
      editingSessions.set(saved.id, saved);
      const applied = {
        ...current,
        status: "applied",
        result: {
          editingSessionId: saved.id,
          optimisticVersion: saved.optimisticVersion,
          affectedIdentities: {
            cvId: saved.cvId,
            blockIds: saved.selections.map((item) => item.blockId),
            versionIds: saved.selections.map((item) => item.versionId),
          },
        },
        nextActions: nextChangeProposalActions("applied"),
      };
      changeProposals.set(id, applied);
      return copy(applied);
    },
    async publish() {
      throw new CvWorkspaceError("explicit-apply-required", "Select an exact CV Revision and apply its publication Change Proposal.");
    },
    async unpublish() {
      throw new CvWorkspaceError("explicit-apply-required", "Withdraw publication through a reviewed Change Proposal.");
    },
    async getPublished(slug) {
      const document = [...records.values()].find(
        (cv) => cv.slug === slug && cv.status === "published",
      );
      if (!document) return null;
      const revision = (revisions.get(document.id) || []).find((item) => item.id === document.publishedRevisionId);
      if (!revision) return null;
      return copy(normalizeDraft({
        ...document,
        themeId: revision.themeId,
        profile: revision.profile,
        summary: revision.summary,
        summaryProvenance: revision.summaryProvenance,
        selections: revision.selections,
      }));
    },
  };
}
