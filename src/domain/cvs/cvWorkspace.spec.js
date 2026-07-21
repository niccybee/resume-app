import { describe, expect, it } from "vitest";
import { addSelection, moveSelection, removeSelection } from "./cvDraft";
import { createCvWorkspace } from "./createCvWorkspace";
import { createMemoryCvRepository } from "./createMemoryCvRepository";

const employment = { blockId: "block-1", versionId: "version-1", section: "experience" };
const skill = { blockId: "block-2", versionId: "version-2", section: "skills" };
const employmentContext = {
  type: "employment",
  key: "e2-digital-marketing-manager",
  label: "E2 · Digital Marketing Manager",
  metadata: {
    companyId: "e2",
    company: "E2",
    roleId: "digital-marketing-manager",
    role: "Digital Marketing Manager",
  },
};

describe("CV workspace boundary", () => {
  it("copies current Editing Session work to a new open session without changing its source", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1", name: "Product Manager at Google", summary: "Revision one", selections: [employment],
    }]);
    const workspace = createCvWorkspace({ repository });
    const source = await workspace.startEditingSession("cv-1");
    const savedSource = await workspace.saveEditingSession({
      ...source, summary: "Alternative direction", selections: [skill],
    });

    const proposal = await workspace.proposeLifecycleChange({
      operation: {
        type: "copy_to_new_version",
        source: { type: "editing_session", id: savedSource.id },
        baseOptimisticVersion: savedSource.optimisticVersion,
      },
    });
    expect(proposal).toMatchObject({ status: "pending", operationType: "copy_to_new_version" });
    await expect(workspace.editingSessions("cv-1")).resolves.toHaveLength(1);

    const applied = await workspace.applyChangeProposal(proposal.id);
    const copied = await workspace.resumeEditingSession(applied.result.editingSessionId);
    expect(copied).toMatchObject({
      cvId: "cv-1", status: "open", baseRevisionId: savedSource.baseRevisionId,
      summary: "Alternative direction", selections: [{ ...skill, order: 0 }],
    });
    expect(copied.id).not.toBe(savedSource.id);
    await expect(workspace.resumeEditingSession(savedSource.id)).resolves.toMatchObject({
      status: "open", optimisticVersion: 2, summary: "Alternative direction",
    });
  });

  it("copies a CV Revision into a new role-focused lineage whose first finish is Revision 1", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1", name: "Product Manager at Google", summary: "Google focus", selections: [employment],
    }]);
    const workspace = createCvWorkspace({ repository });
    const [revision] = await workspace.history("cv-1");
    const proposal = await workspace.proposeLifecycleChange({
      operation: {
        type: "copy_for_new_role",
        source: { type: "cv_revision", id: revision.id, cvId: "cv-1" },
        name: "Head of Marketing at Facebook",
      },
    });
    const applied = await workspace.applyChangeProposal(proposal.id);
    const copied = await workspace.resumeEditingSession(applied.result.editingSessionId);

    expect(copied).toMatchObject({
      cvId: applied.result.cvId, baseRevisionId: null, status: "open",
      name: "Head of Marketing at Facebook", summary: "Google focus",
    });
    expect(copied.cvId).not.toBe("cv-1");
    const finished = await workspace.finishEditingSession(copied.id, copied.optimisticVersion);
    expect(finished.revisionNumber).toBe(1);
    await expect(workspace.open("cv-1")).resolves.toMatchObject({ name: "Product Manager at Google" });
  });

  it("archives and restores Editing Sessions and CVs through proposals without losing work", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1", name: "Product CV", summary: "Retained", selections: [employment],
    }]);
    const workspace = createCvWorkspace({ repository });
    const session = await workspace.startEditingSession("cv-1");
    const saved = await workspace.saveEditingSession({ ...session, selections: [skill] });

    for (const type of ["archive_editing_session", "restore_editing_session"]) {
      const proposal = await workspace.proposeLifecycleChange({
        operation: {
          type,
          target: { type: "editing_session", id: saved.id },
          baseOptimisticVersion: type === "archive_editing_session" ? 2 : 3,
        },
      });
      await workspace.applyChangeProposal(proposal.id);
    }
    await expect(workspace.resumeEditingSession(saved.id)).resolves.toMatchObject({
      status: "open", optimisticVersion: 4, selections: [{ ...skill, order: 0 }],
    });

    for (const type of ["archive_cv", "restore_cv"]) {
      const proposal = await workspace.proposeLifecycleChange({
        operation: { type, target: { type: "cv", id: "cv-1" } },
      });
      await workspace.applyChangeProposal(proposal.id);
      if (type === "archive_cv") {
        await expect(workspace.saveEditingSession({ ...saved, optimisticVersion: 4 }))
          .rejects.toMatchObject({ code: "invalid-lifecycle-transition" });
        await expect(workspace.resumeEditingSession(saved.id)).resolves.toMatchObject({
          status: "open", selections: [{ ...skill, order: 0 }],
        });
        await expect(workspace.publish("cv-1", "product-cv"))
          .rejects.toMatchObject({ code: "invalid-lifecycle-transition" });
        await expect(workspace.save({ ...await workspace.open("cv-1"), name: "Changed while archived" }))
          .rejects.toMatchObject({ code: "invalid-lifecycle-transition" });
      }
    }
    await expect(workspace.open("cv-1")).resolves.toMatchObject({
      status: "draft", summary: "Retained",
    });
    await expect(workspace.resumeEditingSession(saved.id)).resolves.toMatchObject({
      status: "open", selections: [{ ...skill, order: 0 }],
    });
  });

  it("invalidates reviewed session mutations if their parent CV is archived before apply", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1", name: "Product CV", summary: "Before", selections: [employment],
    }]);
    const workspace = createCvWorkspace({ repository });
    const session = await workspace.startEditingSession("cv-1");
    const workingStateProposal = await workspace.proposeEditingSessionChange({
      sessionId: session.id,
      baseOptimisticVersion: session.optimisticVersion,
      operations: [{ type: "replace_working_state", value: { ...session, summary: "After" } }],
    });
    const copyProposal = await workspace.proposeLifecycleChange({
      operation: {
        type: "copy_to_new_version",
        source: { type: "editing_session", id: session.id },
        baseOptimisticVersion: session.optimisticVersion,
      },
    });
    const sessionArchiveProposal = await workspace.proposeLifecycleChange({
      operation: {
        type: "archive_editing_session",
        target: { type: "editing_session", id: session.id },
        baseOptimisticVersion: session.optimisticVersion,
      },
    });
    const cvArchiveProposal = await workspace.proposeLifecycleChange({
      operation: { type: "archive_cv", target: { type: "cv", id: "cv-1" } },
    });
    await workspace.applyChangeProposal(cvArchiveProposal.id);

    for (const proposal of [workingStateProposal, copyProposal, sessionArchiveProposal]) {
      await expect(workspace.applyChangeProposal(proposal.id)).rejects.toMatchObject({
        code: "invalid-lifecycle-transition",
        context: { reason: "archived-cv", target: { cvId: "cv-1" } },
      });
      await expect(workspace.applyChangeProposal(proposal.id)).rejects.toMatchObject({
        code: "invalid-lifecycle-transition",
      });
      await expect(workspace.getChangeProposal(proposal.id)).resolves.toMatchObject({
        status: "invalidated", result: { reason: "archived-cv" },
      });
    }
    await expect(workspace.resumeEditingSession(session.id)).resolves.toMatchObject({
      status: "open", optimisticVersion: 1, summary: "Before",
    });
    await expect(workspace.editingSessions("cv-1")).resolves.toHaveLength(1);
  });

  it("rejects mismatched lifecycle operation targets before proposal persistence", async () => {
    let calls = 0;
    const workspace = createCvWorkspace({
      repository: { async createChangeProposal() { calls += 1; } },
    });
    await expect(workspace.proposeLifecycleChange({
      operation: { type: "archive_editing_session", target: { type: "cv", id: "cv-1" }, baseOptimisticVersion: 1 },
    })).rejects.toMatchObject({ code: "validation-failed" });
    await expect(workspace.proposeLifecycleChange({
      operation: { type: "archive_cv", target: { type: "cv_revision", id: "revision-1" } },
    })).rejects.toMatchObject({ code: "validation-failed" });
    expect(calls).toBe(0);
  });

  it("creates a normalized Change Proposal without mutating its Editing Session, then applies it once", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1",
      name: "Product CV",
      summary: "Before",
      selections: [employment],
    }]);
    const workspace = createCvWorkspace({ repository });
    const session = await workspace.startEditingSession("cv-1");

    const proposal = await workspace.proposeEditingSessionChange({
      sessionId: session.id,
      baseOptimisticVersion: session.optimisticVersion,
      operations: [{
        type: "replace_working_state",
        value: {
          ...session,
          summary: "After",
          selections: [skill],
        },
      }],
    });

    expect(proposal).toMatchObject({
      schemaVersion: "1",
      operationType: "replace_working_state",
      target: { type: "editing_session", id: session.id, cvId: "cv-1" },
      baseOptimisticVersion: 1,
      status: "pending",
      warnings: [],
      nextActions: ["apply", "discard"],
      diff: {
        fields: [{ path: "summary", before: "Before", after: "After" }],
        composition: {
          added: [expect.objectContaining({ blockId: "block-2" })],
          removed: [expect.objectContaining({ blockId: "block-1" })],
        },
      },
    });
    expect(proposal.expiresAt).toBeTruthy();
    await expect(workspace.resumeEditingSession(session.id)).resolves.toMatchObject({
      optimisticVersion: 1,
      summary: "Before",
      selections: [{ ...employment, order: 0 }],
    });

    const applied = await workspace.applyChangeProposal(proposal.id);
    const retried = await workspace.applyChangeProposal(proposal.id);
    expect(applied).toMatchObject({
      status: "applied",
      result: {
        editingSessionId: session.id,
        optimisticVersion: 2,
        affectedIdentities: {
          cvId: "cv-1",
          blockIds: ["block-2"],
          versionIds: ["version-2"],
        },
      },
    });
    expect(retried).toEqual(applied);
    await expect(workspace.resumeEditingSession(session.id)).resolves.toMatchObject({
      optimisticVersion: 2,
      summary: "After",
      selections: [{ ...skill, order: 0 }],
    });
  });

  it("discards and expires Change Proposals without mutating session state", async () => {
    let now = new Date("2026-07-21T00:00:00.000Z");
    const repository = createMemoryCvRepository([{
      id: "cv-1",
      name: "Product CV",
      summary: "Before",
      selections: [],
    }], { clock: () => now });
    const workspace = createCvWorkspace({ repository });
    const session = await workspace.startEditingSession("cv-1");
    const input = {
      sessionId: session.id,
      baseOptimisticVersion: session.optimisticVersion,
      operations: [{
        type: "replace_working_state",
        value: { ...session, summary: "Never applied" },
      }],
    };
    const discarded = await workspace.proposeEditingSessionChange(input);
    await expect(workspace.discardChangeProposal(discarded.id)).resolves.toMatchObject({
      status: "discarded",
      nextActions: [],
    });
    await expect(workspace.applyChangeProposal(discarded.id)).rejects.toMatchObject({
      code: "invalid-proposal-state",
    });

    const expiring = await workspace.proposeEditingSessionChange(input);
    now = new Date("2026-07-22T00:00:01.000Z");
    await expect(workspace.applyChangeProposal(expiring.id)).rejects.toMatchObject({
      code: "proposal-expired",
    });
    await expect(workspace.applyChangeProposal(expiring.id)).rejects.toMatchObject({
      code: "proposal-expired",
    });
    await expect(workspace.getChangeProposal(expiring.id)).resolves.toMatchObject({
      status: "expired",
    });
    await expect(workspace.resumeEditingSession(session.id)).resolves.toMatchObject({
      optimisticVersion: 1,
      summary: "Before",
    });
  });

  it("returns a stable stale-proposal conflict with refreshed Editing Session context", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1",
      name: "Product CV",
      summary: "Before",
      selections: [],
    }]);
    const workspace = createCvWorkspace({ repository });
    const session = await workspace.startEditingSession("cv-1");
    const proposal = await workspace.proposeEditingSessionChange({
      sessionId: session.id,
      baseOptimisticVersion: 1,
      operations: [{
        type: "replace_working_state",
        value: { ...session, summary: "Stale proposal" },
      }],
    });
    await workspace.saveEditingSession({ ...session, summary: "Winning change" });

    const staleConflict = {
      code: "stale-proposal",
      context: {
        target: { id: session.id, optimisticVersion: 2, summary: "Winning change" },
      },
    };
    await expect(workspace.applyChangeProposal(proposal.id)).rejects.toMatchObject(staleConflict);
    await expect(workspace.applyChangeProposal(proposal.id)).rejects.toMatchObject(staleConflict);
    await expect(workspace.getChangeProposal(proposal.id)).resolves.toMatchObject({
      status: "invalidated",
    });
  });

  it("rejects unsupported or malformed Change Proposal operations before persistence", async () => {
    let calls = 0;
    const workspace = createCvWorkspace({
      repository: {
        async getEditingSession() {
          return { id: "session-1", cvId: "cv-1", optimisticVersion: 1, status: "open", name: "CV", selections: [] };
        },
        async createChangeProposal() { calls += 1; },
      },
    });

    await expect(workspace.proposeEditingSessionChange({
      sessionId: "session-1",
      baseOptimisticVersion: 1,
      operations: [{ type: "delete_everything" }],
    })).rejects.toMatchObject({ code: "validation-failed" });
    await expect(workspace.proposeEditingSessionChange({
      sessionId: "session-1",
      baseOptimisticVersion: 1,
      operations: [],
    })).rejects.toMatchObject({ code: "validation-failed" });
    expect(calls).toBe(0);
  });

  it("exposes immutable CV Revision history for an existing lineage", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1",
      name: "Google Product Manager",
      themeId: "modern",
      summary: "Led product delivery.",
      selections: [employment],
    }]);
    const workspace = createCvWorkspace({ repository });

    const history = await workspace.history("cv-1");
    history[0].summary = "Mutated outside the repository";

    expect(history[0]).toMatchObject({
      cvId: "cv-1",
      number: 1,
      baseRevisionId: null,
    });
    await expect(workspace.history("cv-1")).resolves.toEqual([
      expect.objectContaining({
        number: 1,
        themeId: "modern",
        summary: "Led product delivery.",
      }),
    ]);
  });

  it("resolves a Base Revision to its domain-facing Revision number", async () => {
    const workspace = createCvWorkspace({
      repository: {
        async listRevisions() {
          return [{
            id: "revision-2",
            cvId: "cv-1",
            number: 2,
            baseRevisionId: "revision-1",
          }, {
            id: "revision-1",
            cvId: "cv-1",
            number: 1,
            baseRevisionId: null,
          }];
        },
      },
    });

    await expect(workspace.history("cv-1")).resolves.toEqual([
      expect.objectContaining({ number: 2, baseRevisionNumber: 1 }),
      expect.objectContaining({ number: 1, baseRevisionNumber: null }),
    ]);
  });

  it("starts multiple durable Editing Sessions from any CV Revision", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1",
      name: "Google Product Manager",
      themeId: "modern",
      profile: { basics: { name: "Nic" } },
      summary: "Revision one",
      selections: [employment],
    }]);
    const workspace = createCvWorkspace({ repository });

    const first = await workspace.startEditingSession(
      "cv-1",
      "cv-1-revision-1",
    );
    const second = await workspace.startEditingSession("cv-1");
    const saved = await workspace.saveEditingSession({
      ...first,
      summary: "Persisted working summary",
      selections: [skill],
    });

    expect(first.id).not.toBe(second.id);
    expect(saved.optimisticVersion).toBe(2);
    await expect(workspace.editingSessions("cv-1")).resolves.toEqual([
      expect.objectContaining({ id: first.id, status: "open", baseRevisionNumber: 1 }),
      expect.objectContaining({ id: second.id, status: "open", baseRevisionNumber: 1 }),
    ]);
    await expect(workspace.resumeEditingSession(first.id)).resolves.toMatchObject({
      id: first.id,
      cvId: "cv-1",
      baseRevisionId: "cv-1-revision-1",
      optimisticVersion: 2,
      themeId: "modern",
      profile: { basics: { name: "Nic" } },
      summary: "Persisted working summary",
      selections: [{ ...skill, order: 0 }],
    });
  });

  it("creates an initial Revision when a newly saved CV starts its first Editing Session", async () => {
    const workspace = createCvWorkspace({
      repository: createMemoryCvRepository(),
    });
    const saved = await workspace.save({
      name: "New Product CV",
      summary: "Legacy working summary",
      selections: [employment],
    });

    const session = await workspace.startEditingSession(saved.id);

    expect(session).toMatchObject({
      cvId: saved.id,
      baseRevisionNumber: 1,
      summary: "Legacy working summary",
      selections: [{ ...employment, order: 0 }],
    });
    await expect(workspace.history(saved.id)).resolves.toEqual([
      expect.objectContaining({ number: 1, baseRevisionId: null }),
    ]);
  });

  it("finishes sessions once with sequential completion numbers and separate ancestry", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1",
      name: "Google Product Manager",
      slug: "google-product-manager",
      status: "published",
      publishedAt: "2026-07-21T00:00:00.000Z",
      summary: "Published Revision one",
      selections: [employment],
    }]);
    const workspace = createCvWorkspace({ repository });
    const slower = await workspace.startEditingSession("cv-1");
    const faster = await workspace.startEditingSession("cv-1");
    const savedFaster = await workspace.saveEditingSession({
      ...faster,
      name: "Stale parallel CV name",
      summary: "Finished first",
    });

    const firstFinish = await workspace.finishEditingSession(
      savedFaster.id,
      savedFaster.optimisticVersion,
    );
    const secondFinish = await workspace.finishEditingSession(
      slower.id,
      slower.optimisticVersion,
    );
    const retried = await workspace.finishEditingSession(
      savedFaster.id,
      savedFaster.optimisticVersion,
    );

    expect(firstFinish).toMatchObject({ status: "finished", revisionNumber: 2 });
    expect(secondFinish).toMatchObject({ status: "finished", revisionNumber: 3 });
    expect(retried.finishedRevisionId).toBe(firstFinish.finishedRevisionId);
    await expect(workspace.history("cv-1")).resolves.toEqual([
      expect.objectContaining({ number: 3, baseRevisionNumber: 1 }),
      expect.objectContaining({ number: 2, baseRevisionNumber: 1 }),
      expect.objectContaining({ number: 1, baseRevisionNumber: null }),
    ]);
    await expect(workspace.open("cv-1")).resolves.toMatchObject({
      status: "published",
      slug: "google-product-manager",
      publishedAt: "2026-07-21T00:00:00.000Z",
      name: "Google Product Manager",
    });
  });

  it("rejects stale Editing Session saves without losing persisted work", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1",
      name: "Product CV",
      selections: [employment],
    }]);
    const workspace = createCvWorkspace({ repository });
    const session = await workspace.startEditingSession("cv-1");
    const saved = await workspace.saveEditingSession({
      ...session,
      summary: "Winning update",
    });

    await expect(workspace.saveEditingSession({
      ...session,
      summary: "Stale update",
    })).rejects.toMatchObject({ code: "session-conflict" });
    await expect(workspace.resumeEditingSession(session.id)).resolves.toMatchObject({
      optimisticVersion: saved.optimisticVersion,
      summary: "Winning update",
    });
  });

  it("composes, saves, and reloads exact block versions", async () => {
    const repository = createMemoryCvRepository();
    const workspace = createCvWorkspace({ repository });
    let draft = { name: "Product CV", selections: [] };
    draft = addSelection(draft, employment);
    draft = addSelection(draft, skill);
    draft = moveSelection(draft, "version-2", "experience", 0);
    draft = removeSelection(draft, "version-1");
    const saved = await workspace.save(draft);
    expect(await workspace.open(saved.id)).toMatchObject({
      name: "Product CV",
      selections: [{ ...skill, section: "experience", order: 0 }],
    });
  });

  it("rejects multiple Block Versions from one CV Block at save and open boundaries", async () => {
    const duplicateSelections = [{
      blockId: "block-1",
      versionId: "version-1",
      section: "experience",
    }, {
      blockId: "block-1",
      versionId: "version-2",
      section: "experience",
    }];
    const workspace = createCvWorkspace({ repository: createMemoryCvRepository() });
    const legacyWorkspace = createCvWorkspace({
      repository: {
        async get() {
          return {
            id: "cv-invalid",
            name: "Invalid legacy CV",
            selections: duplicateSelections,
          };
        },
      },
    });

    await expect(workspace.save({
      name: "Product CV",
      selections: duplicateSelections,
    })).rejects.toMatchObject({
      code: "duplicate-block-selection",
    });
    await expect(legacyWorkspace.open("cv-invalid")).rejects.toMatchObject({
      code: "duplicate-block-selection",
    });
  });

  it("rejects malformed exact selections at save and open boundaries", async () => {
    const workspace = createCvWorkspace({ repository: createMemoryCvRepository() });
    const legacyWorkspace = createCvWorkspace({
      repository: {
        async get() {
          return {
            id: "cv-invalid",
            name: "Invalid legacy CV",
            selections: [{
              blockId: "block-1",
              versionId: "version-1",
              section: "unsupported",
            }],
          };
        },
      },
    });

    await expect(workspace.save({
      name: "Product CV",
      selections: [{ versionId: "version-1", section: "experience" }],
    })).rejects.toMatchObject({ code: "invalid-selection" });
    await expect(legacyWorkspace.open("cv-invalid")).rejects.toMatchObject({
      code: "invalid-section",
    });
  });

  it("preserves employer grouping when an experience version is saved and reloaded", async () => {
    const repository = createMemoryCvRepository();
    const workspace = createCvWorkspace({ repository });
    const draft = addSelection(
      { name: "Marketing CV", selections: [] },
      {
        ...employment,
        content: { text: "Led a cross-functional CRM migration." },
        block: {
          title: "CRM migration leadership",
          contexts: [employmentContext],
        },
      },
    );

    const saved = await workspace.save(draft);

    expect(await workspace.open(saved.id)).toMatchObject({
      selections: [
        {
          blockId: "block-1",
          versionId: "version-1",
          group: {
            employerId: "e2",
            employer: "E2",
            roleId: "digital-marketing-manager",
            role: "Digital Marketing Manager",
          },
        },
      ],
    });
  });

  it("preserves separate employment occasions at the same employer", async () => {
    const repository = createMemoryCvRepository();
    const workspace = createCvWorkspace({ repository });
    const earlierContext = {
      ...employmentContext,
      key: "e2-digital-marketing-manager-2021-03",
      metadata: {
        ...employmentContext.metadata,
        occasionId: "e2-digital-marketing-manager-2021-03",
        startDate: "2021-03",
        endDate: "2022-06",
      },
    };
    const currentContext = {
      ...employmentContext,
      key: "e2-digital-marketing-manager-2024-02",
      metadata: {
        ...employmentContext.metadata,
        occasionId: "e2-digital-marketing-manager-2024-02",
        startDate: "2024-02",
        endDate: "present",
      },
    };
    let draft = addSelection(
      { name: "Marketing CV", selections: [] },
      {
        blockId: "block-earlier",
        versionId: "version-earlier",
        section: "experience",
        block: { contexts: [earlierContext] },
        content: { text: "Led lifecycle reporting." },
      },
    );
    draft = addSelection(draft, {
      blockId: "block-current",
      versionId: "version-current",
      section: "experience",
      block: { contexts: [currentContext] },
      content: { text: "Rebuilt acquisition planning." },
    });

    const saved = await workspace.save(draft);
    const reopened = await workspace.open(saved.id);

    expect(reopened.selections.map((selection) => selection.group)).toEqual([
      expect.objectContaining({
        occasionId: "e2-digital-marketing-manager-2021-03",
        startDate: "2021-03",
        endDate: "2022-06",
      }),
      expect.objectContaining({
        occasionId: "e2-digital-marketing-manager-2024-02",
        startDate: "2024-02",
        endDate: "present",
      }),
    ]);
  });

  it("previews a private draft without publishing it", async () => {
    const repository = createMemoryCvRepository([{ id: "cv-1", name: "Private", selections: [] }]);
    const workspace = createCvWorkspace({ repository });
    expect(await workspace.preview("cv-1")).toMatchObject({ preview: true, status: "draft" });
    expect(await workspace.getPublic("private")).toBeNull();
  });

  it("publishes uniquely and unpublishes without deleting", async () => {
    const repository = createMemoryCvRepository([
      { id: "cv-1", name: "Product CV", selections: [] },
      { id: "cv-2", name: "Other", slug: "other", status: "published", selections: [] },
    ]);
    const workspace = createCvWorkspace({ repository });
    await expect(workspace.publish("cv-1", "other")).rejects.toMatchObject({ code: "slug-conflict" });
    await workspace.publish("cv-1", "Product Lead CV");
    expect(await workspace.getPublic("product-lead-cv")).toMatchObject({ id: "cv-1" });
    await workspace.unpublish("cv-1");
    expect(await workspace.getPublic("product-lead-cv")).toBeNull();
    expect(await workspace.open("cv-1")).toMatchObject({ id: "cv-1", status: "draft" });
  });

  it("keeps generated summaries as proposals until accepted", async () => {
    const repository = createMemoryCvRepository();
    const workspace = createCvWorkspace({
      repository,
      summaryGenerator: {
        name: "fake-ai",
        async suggest() {
          return {
            text: "A focused product leader.",
            model: "test-model-v1",
            createdAt: "2026-07-21T01:00:00.000Z",
          };
        },
      },
    });
    const draft = { name: "Product CV", summary: "Existing", selections: [] };
    const proposal = await workspace.suggestSummary(draft, "Focus on leadership");
    expect(draft.summary).toBe("Existing");
    expect(workspace.acceptSummary(draft, proposal)).toMatchObject({
      summary: "A focused product leader.",
      summaryProvenance: {
        type: "ai",
        provider: "fake-ai",
        model: "test-model-v1",
        createdAt: "2026-07-21T01:00:00.000Z",
      },
    });
  });
});
