// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CvDraftEditor from "./CvDraftEditor.vue";
import { createTaskBlocks } from "../domain/tasks/createTaskBlocks";
import { blockLibrary } from "../services/blockLibrary";
import { cvWorkspace } from "../services/cvWorkspace";

let routeParams = { cvId: "cv-1" };
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: routeParams }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("../services/blockLibrary", () => ({
  blockLibrary: {
    browse: vi.fn(),
  },
}));
vi.mock("../domain/tasks/createTaskBlocks", () => ({
  createTaskBlocks: vi.fn(),
}));
vi.mock("../services/cvWorkspace", () => ({
  cvWorkspace: {
    open: vi.fn(),
    history: vi.fn(),
    editingSessions: vi.fn(),
    startEditingSession: vi.fn(),
    createCvEditingSession: vi.fn(),
    resumeEditingSession: vi.fn(),
    saveEditingSession: vi.fn(),
    finishEditingSession: vi.fn(),
    proposeEditingSessionChange: vi.fn(),
    proposeLifecycleChange: vi.fn(),
    applyChangeProposal: vi.fn(),
    discardChangeProposal: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    suggestSummary: vi.fn(),
    acceptSummary: vi.fn((draft, proposal) => ({
      ...draft,
      summary: proposal.text,
      summaryProvenance: proposal.provenance,
    })),
  },
}));

function button(wrapper, label) {
  return wrapper.findAll("button").find((item) => item.text() === label);
}

async function mountEditor({ taskChatStub = true, cvId = "cv-1" } = {}) {
  routeParams = cvId ? { cvId } : {};
  const wrapper = mount(CvDraftEditor, {
    global: {
      stubs: {
        NuxtLink: { template: "<a><slot /></a>" },
        TaskChat: taskChatStub,
        UButton: {
          props: ["loading", "disabled"],
          template: '<button :disabled="disabled || loading" :aria-busy="loading ? \'true\' : undefined"><slot /></button>',
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("CV summary proposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { cvId: "cv-1" };
    blockLibrary.browse.mockResolvedValue({ blocks: [], experience: [], sidebar: {} });
    createTaskBlocks.mockResolvedValue([]);
    cvWorkspace.history.mockResolvedValue([]);
    cvWorkspace.editingSessions.mockResolvedValue([]);
    cvWorkspace.open.mockResolvedValue({
      id: "cv-1",
      name: "Product CV",
      profile: { basics: { name: "Nic", label: "Product Lead" } },
      summary: "Existing summary",
      selections: [],
    });
  });

  it("shows immutable CV Revision history in the Nuxt editor", async () => {
    cvWorkspace.history.mockResolvedValue([{
      id: "revision-2",
      cvId: "cv-1",
      number: 2,
      baseRevisionId: "revision-1",
      baseRevisionNumber: 1,
      createdAt: "2026-07-21T00:00:00.000Z",
    }, {
      id: "revision-1",
      cvId: "cv-1",
      number: 1,
      baseRevisionId: null,
      baseRevisionNumber: null,
      createdAt: "2026-07-20T00:00:00.000Z",
    }]);

    const wrapper = await mountEditor();

    expect(wrapper.text()).toContain("Revision history");
    expect(wrapper.text()).toContain("Revision 2 · based on Revision 1");
    expect(wrapper.text()).toContain("Revision 1");
    expect(wrapper.text()).not.toContain("revision-1");
  });

  it("starts and resumes durable Editing Sessions from any CV Revision", async () => {
    cvWorkspace.history.mockResolvedValue([{
      id: "revision-2",
      cvId: "cv-1",
      number: 2,
      baseRevisionId: "revision-1",
      baseRevisionNumber: 1,
    }, {
      id: "revision-1",
      cvId: "cv-1",
      number: 1,
      baseRevisionId: null,
      baseRevisionNumber: null,
    }]);
    cvWorkspace.editingSessions.mockResolvedValue([{
      id: "session-1",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: "revision-1",
      baseRevisionNumber: 1,
      optimisticVersion: 3,
    }]);
    const startedSession = {
      id: "session-2",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: "revision-2",
      baseRevisionNumber: 2,
      optimisticVersion: 1,
      name: "Product CV",
      profile: { basics: { name: "Nic" } },
      summary: "Revision two",
      selections: [],
    };
    const existingSession = {
      id: "session-1",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: "revision-1",
      optimisticVersion: 3,
      name: "Product CV",
      profile: { basics: { name: "Nic" } },
      summary: "Persisted session work",
      selections: [],
    };
    cvWorkspace.resumeEditingSession.mockResolvedValueOnce(existingSession).mockResolvedValueOnce(startedSession);
    cvWorkspace.proposeLifecycleChange.mockResolvedValue({
      id: "proposal-start", operationType: "start_editing_session", status: "pending",
    });
    cvWorkspace.applyChangeProposal.mockResolvedValue({
      id: "proposal-start", operationType: "start_editing_session", status: "applied",
      result: { cvId: "cv-1", editingSessionId: "session-2", optimisticVersion: 1 },
    });
    const wrapper = await mountEditor();

    expect(wrapper.text()).toContain("Open Editing Sessions");
    expect(wrapper.text()).toContain("based on Revision 1");
    expect(button(wrapper, "Start from Revision 2")).toBeTruthy();
    expect(button(wrapper, "Start from Revision 1")).toBeTruthy();

    await button(wrapper, "Resume Editing Session").trigger("click");
    await flushPromises();
    expect(cvWorkspace.resumeEditingSession).toHaveBeenCalledWith("session-1");
    expect(wrapper.text()).toContain("Editing Session based on Revision 1");
    expect(wrapper.get(".live-preview").text()).toContain("Persisted session work");

    await button(wrapper, "Start from Revision 2").trigger("click");
    await flushPromises();
    expect(cvWorkspace.proposeLifecycleChange).toHaveBeenCalledWith({ operation: {
      type: "start_editing_session", target: { type: "cv", id: "cv-1" }, baseRevisionId: "revision-2",
    } });
    expect(cvWorkspace.startEditingSession).not.toHaveBeenCalled();
    await button(wrapper, "Apply Proposed Changes").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Editing Session based on Revision 2");
  });

  it("starts a base-less first Editing Session when no session or Revision exists", async () => {
    cvWorkspace.history.mockResolvedValue([]);
    const firstSession = {
      id: "session-first",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: null,
      baseRevisionNumber: null,
      optimisticVersion: 1,
      name: "Product CV",
      profile: { basics: { name: "Nic" } },
      summary: "Existing summary",
      selections: [],
    };
    cvWorkspace.proposeLifecycleChange.mockResolvedValue({
      id: "proposal-start", operationType: "start_editing_session", status: "pending",
    });
    cvWorkspace.applyChangeProposal.mockResolvedValue({
      id: "proposal-start", operationType: "start_editing_session", status: "applied",
      result: { cvId: "cv-1", editingSessionId: "session-first", optimisticVersion: 1 },
    });
    cvWorkspace.resumeEditingSession.mockResolvedValue(firstSession);
    const wrapper = await mountEditor();

    await button(wrapper, "Start first Editing Session").trigger("click");
    await flushPromises();

    expect(cvWorkspace.proposeLifecycleChange).toHaveBeenCalledWith({ operation: {
      type: "start_editing_session", target: { type: "cv", id: "cv-1" }, baseRevisionId: null,
    } });
    await button(wrapper, "Apply Proposed Changes").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Initial Editing Session");
  });

  it("offers resume instead of a duplicate first session after reloading a new CV", async () => {
    cvWorkspace.history.mockResolvedValue([]);
    cvWorkspace.editingSessions.mockResolvedValue([{
      id: "session-first",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: null,
      baseRevisionNumber: null,
      optimisticVersion: 1,
    }]);

    const wrapper = await mountEditor();

    expect(button(wrapper, "Start first Editing Session")).toBeUndefined();
    expect(button(wrapper, "Resume Editing Session")).toBeTruthy();
  });

  it("opens lineage-only CV metadata before an Editing Session is resumed", async () => {
    cvWorkspace.open.mockResolvedValue({
      id: "cv-1",
      name: "Product CV",
      status: "draft",
      publishedRevisionId: null,
    });
    cvWorkspace.editingSessions.mockResolvedValue([{
      id: "session-1",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: "revision-1",
      baseRevisionNumber: 1,
      optimisticVersion: 2,
    }]);

    const wrapper = await mountEditor();

    expect(wrapper.find('input[placeholder="Product lead CV"]').element.value).toBe("Product CV");
    expect(wrapper.find('input[type="email"]').element.value).toBe("");
    expect(button(wrapper, "Resume Editing Session")).toBeTruthy();
  });

  it("persists and finishes the active Editing Session through optimistic versions", async () => {
    const summary = {
      id: "session-1",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: "revision-1",
      baseRevisionNumber: 1,
      optimisticVersion: 3,
    };
    cvWorkspace.history.mockResolvedValue([{
      id: "revision-1",
      cvId: "cv-1",
      number: 1,
      baseRevisionId: null,
    }]);
    cvWorkspace.editingSessions.mockResolvedValue([summary]);
    cvWorkspace.resumeEditingSession.mockResolvedValue({
      ...summary,
      name: "Product CV",
      profile: { basics: { name: "Nic" } },
      summary: "Persisted session work",
      selections: [],
    });
    cvWorkspace.saveEditingSession.mockImplementation(async (session) => ({
      ...session,
      optimisticVersion: session.optimisticVersion + 1,
    }));
    cvWorkspace.proposeLifecycleChange.mockResolvedValue({
      id: "proposal-finish", operationType: "finish_editing_session", status: "pending",
    });
    cvWorkspace.applyChangeProposal.mockResolvedValue({
      id: "proposal-finish", operationType: "finish_editing_session", status: "applied",
      result: { cvId: "cv-1", editingSessionId: "session-1", optimisticVersion: 6, revisionId: "revision-2", revisionNumber: 2 },
    });
    const wrapper = await mountEditor();

    await button(wrapper, "Resume Editing Session").trigger("click");
    await flushPromises();
    await wrapper.get('input[placeholder="Product lead CV"]').setValue(
      "Google Product Manager",
    );
    await button(wrapper, "Save Editing Session").trigger("click");
    await flushPromises();

    expect(cvWorkspace.saveEditingSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "session-1",
        cvId: "cv-1",
        optimisticVersion: 3,
        name: "Google Product Manager",
      }),
    );
    expect(wrapper.text()).toContain("working version 4");

    await button(wrapper, "Finish as CV Revision").trigger("click");
    await flushPromises();
    expect(cvWorkspace.proposeLifecycleChange).toHaveBeenCalledWith({ operation: {
      type: "finish_editing_session",
      target: { type: "editing_session", id: "session-1" },
      baseOptimisticVersion: 5,
    } });
    expect(cvWorkspace.finishEditingSession).not.toHaveBeenCalled();
    await button(wrapper, "Apply Proposed Changes").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain(
      "finished as Revision 2",
    );
  });

  it("reviews and explicitly applies an Editing Session Change Proposal through the shared application service", async () => {
    const session = {
      id: "session-1", cvId: "cv-1", status: "open",
      baseRevisionId: "revision-1", baseRevisionNumber: 1,
      optimisticVersion: 3, name: "Product CV",
      profile: { basics: { name: "Nic" } }, summary: "Before", selections: [],
    };
    cvWorkspace.history.mockResolvedValue([{ id: "revision-1", cvId: "cv-1", number: 1 }]);
    cvWorkspace.editingSessions.mockResolvedValue([session]);
    cvWorkspace.resumeEditingSession
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ ...session, optimisticVersion: 4, name: "Google Product Manager" });
    cvWorkspace.proposeEditingSessionChange.mockResolvedValue({
      id: "proposal-1",
      schemaVersion: "1",
      operationType: "edit_content",
      target: { type: "editing_session", id: "session-1", cvId: "cv-1" },
      baseOptimisticVersion: 3,
      status: "pending",
      diff: { fields: [{ path: "name", before: "Product CV", after: "Google Product Manager" }], composition: { added: [], removed: [] } },
      warnings: [],
      expiresAt: "2026-07-22T00:00:00.000Z",
      nextActions: ["apply", "discard"],
    });
    cvWorkspace.applyChangeProposal.mockResolvedValue({
      id: "proposal-1", status: "applied",
      result: { editingSessionId: "session-1", optimisticVersion: 4 },
    });
    const wrapper = await mountEditor();

    await button(wrapper, "Resume Editing Session").trigger("click");
    await flushPromises();
    await wrapper.get('input[placeholder="Product lead CV"]').setValue("Google Product Manager");
    await button(wrapper, "Review Change Proposal").trigger("click");
    await flushPromises();

    expect(cvWorkspace.proposeEditingSessionChange).toHaveBeenCalledWith({
      sessionId: "session-1",
      baseOptimisticVersion: 3,
      operations: [{
        type: "replace_working_state",
        value: expect.objectContaining({ name: "Google Product Manager" }),
      }],
    });
    expect(cvWorkspace.applyChangeProposal).not.toHaveBeenCalled();
    expect(wrapper.get('[aria-label="Editing Session Change Proposal"]').text()).toContain("name");
    expect(wrapper.get('[aria-label="Editing Session Change Proposal"]').text()).toContain("Editing Session working version 3");

    await button(wrapper, "Apply Proposed Changes").trigger("click");
    await flushPromises();
    expect(cvWorkspace.applyChangeProposal).toHaveBeenCalledWith("proposal-1");
    expect(cvWorkspace.resumeEditingSession).toHaveBeenLastCalledWith("session-1");
    expect(wrapper.get('[role="status"]').text()).toContain("Change Proposal applied");
    expect(wrapper.text()).toContain("working version 4");
  });

  it("discards an Editing Session Change Proposal without applying it", async () => {
    const session = {
      id: "session-1", cvId: "cv-1", status: "open", baseRevisionId: "revision-1",
      baseRevisionNumber: 1, optimisticVersion: 1, name: "Product CV", profile: { basics: {} }, selections: [],
    };
    cvWorkspace.history.mockResolvedValue([{ id: "revision-1", cvId: "cv-1", number: 1 }]);
    cvWorkspace.editingSessions.mockResolvedValue([session]);
    cvWorkspace.resumeEditingSession.mockResolvedValue(session);
    cvWorkspace.proposeEditingSessionChange.mockResolvedValue({
      id: "proposal-1", status: "pending", baseOptimisticVersion: 1,
      diff: { fields: [], composition: { added: [], removed: [] } }, warnings: [],
      expiresAt: "2026-07-22T00:00:00.000Z", nextActions: ["apply", "discard"],
    });
    cvWorkspace.discardChangeProposal.mockResolvedValue({ id: "proposal-1", status: "discarded" });
    const wrapper = await mountEditor();
    await button(wrapper, "Resume Editing Session").trigger("click");
    await flushPromises();
    await button(wrapper, "Review Change Proposal").trigger("click");
    await flushPromises();
    await button(wrapper, "Discard Change Proposal").trigger("click");
    await flushPromises();

    expect(cvWorkspace.discardChangeProposal).toHaveBeenCalledWith("proposal-1");
    expect(cvWorkspace.applyChangeProposal).not.toHaveBeenCalled();
    expect(wrapper.find('[aria-label="Editing Session Change Proposal"]').exists()).toBe(false);
  });

  it("reviews and applies Copy to New Version without closing the source session", async () => {
    const source = {
      id: "session-1", cvId: "cv-1", status: "open", baseRevisionId: "revision-1",
      baseRevisionNumber: 1, optimisticVersion: 2, name: "Product CV",
      profile: { basics: {} }, summary: "Source work", selections: [],
    };
    const copied = { ...source, id: "session-2", optimisticVersion: 1 };
    cvWorkspace.history.mockResolvedValue([{ id: "revision-1", cvId: "cv-1", number: 1 }]);
    cvWorkspace.editingSessions.mockResolvedValue([source]);
    cvWorkspace.resumeEditingSession.mockResolvedValueOnce(source).mockResolvedValueOnce(copied);
    cvWorkspace.proposeLifecycleChange.mockResolvedValue({
      id: "proposal-copy", operationType: "copy_to_new_version", status: "pending",
      target: { type: "editing_session", id: "session-1" }, baseOptimisticVersion: 2,
      diff: { lifecycle: { operation: "copy_to_new_version" } }, warnings: [],
      expiresAt: "2026-07-22T00:00:00.000Z",
    });
    cvWorkspace.applyChangeProposal.mockResolvedValue({
      id: "proposal-copy", operationType: "copy_to_new_version", status: "applied",
      result: { cvId: "cv-1", editingSessionId: "session-2", optimisticVersion: 1 },
    });
    const wrapper = await mountEditor();
    await button(wrapper, "Resume Editing Session").trigger("click");
    await flushPromises();
    await button(wrapper, "Copy to New Version").trigger("click");
    await flushPromises();
    expect(cvWorkspace.proposeLifecycleChange).toHaveBeenCalledWith({
      operation: {
        type: "copy_to_new_version",
        source: { type: "editing_session", id: "session-1" },
        baseOptimisticVersion: 2,
      },
    });
    expect(cvWorkspace.applyChangeProposal).not.toHaveBeenCalled();
    await button(wrapper, "Apply Proposed Changes").trigger("click");
    await flushPromises();
    expect(cvWorkspace.resumeEditingSession).toHaveBeenLastCalledWith("session-2");
    expect(wrapper.text()).toContain("working version 1");
  });

  it("reviews archive and restore proposals while retaining the session", async () => {
    const open = {
      id: "session-1", cvId: "cv-1", status: "open", baseRevisionId: "revision-1",
      baseRevisionNumber: 1, optimisticVersion: 1, name: "Product CV", profile: { basics: {} }, selections: [],
    };
    const archived = { ...open, status: "archived", optimisticVersion: 2 };
    cvWorkspace.history.mockResolvedValue([{ id: "revision-1", cvId: "cv-1", number: 1 }]);
    cvWorkspace.editingSessions.mockResolvedValueOnce([open]).mockResolvedValue([archived]);
    cvWorkspace.resumeEditingSession.mockResolvedValue(open);
    cvWorkspace.proposeLifecycleChange.mockResolvedValue({
      id: "proposal-archive", operationType: "archive_editing_session", status: "pending",
      target: { type: "editing_session", id: "session-1" }, baseOptimisticVersion: 1,
      diff: { lifecycle: { operation: "archive_editing_session" } }, warnings: [], expiresAt: "later",
    });
    cvWorkspace.applyChangeProposal.mockResolvedValue({
      operationType: "archive_editing_session", status: "applied",
      result: { cvId: "cv-1", editingSessionId: "session-1", optimisticVersion: 2 },
    });
    const wrapper = await mountEditor();
    await button(wrapper, "Resume Editing Session").trigger("click");
    await flushPromises();
    await button(wrapper, "Archive Editing Session").trigger("click");
    await flushPromises();
    await button(wrapper, "Apply Proposed Changes").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Archived Editing Sessions");
    expect(button(wrapper, "Restore Editing Session")).toBeDefined();
  });

  it("allows a Revision copy for a new role without an active session", async () => {
    cvWorkspace.history.mockResolvedValue([{ id: "revision-1", cvId: "cv-1", number: 1 }]);
    cvWorkspace.proposeLifecycleChange.mockResolvedValue({
      id: "proposal-role", operationType: "copy_for_new_role", status: "pending",
      target: { type: "cv_revision", id: "revision-1", cvId: "cv-1" },
      diff: { lifecycle: { operation: "copy_for_new_role" } }, warnings: [], expiresAt: "later",
    });
    const wrapper = await mountEditor();
    await wrapper.get('input[placeholder="Head of Marketing at Facebook"]').setValue("Head of Marketing at Facebook");
    await button(wrapper, "Copy for New Role").trigger("click");
    await flushPromises();
    expect(cvWorkspace.proposeLifecycleChange).toHaveBeenCalledWith({
      operation: {
        type: "copy_for_new_role",
        source: { type: "cv_revision", id: "revision-1", cvId: "cv-1" },
        name: "Head of Marketing at Facebook",
      },
    });
  });

  it("removes Editing Session and publication actions after archiving a CV", async () => {
    const session = {
      id: "session-1", cvId: "cv-1", status: "open", baseRevisionId: "revision-1",
      baseRevisionNumber: 1, optimisticVersion: 1, name: "Product CV", profile: { basics: {} }, selections: [],
    };
    cvWorkspace.history.mockResolvedValue([{ id: "revision-1", cvId: "cv-1", number: 1 }]);
    cvWorkspace.editingSessions.mockResolvedValue([session]);
    cvWorkspace.resumeEditingSession.mockResolvedValue(session);
    cvWorkspace.proposeLifecycleChange.mockResolvedValue({
      id: "proposal-cv-archive", operationType: "archive_cv", status: "pending",
      target: { type: "cv", id: "cv-1" }, diff: { lifecycle: { operation: "archive_cv" } }, warnings: [], expiresAt: "later",
    });
    cvWorkspace.applyChangeProposal.mockResolvedValue({
      operationType: "archive_cv", status: "applied", result: { cvId: "cv-1", status: "archived" },
    });
    cvWorkspace.open.mockResolvedValueOnce({
      id: "cv-1", name: "Product CV", status: "draft", profile: { basics: {} }, selections: [],
    }).mockResolvedValueOnce({
      id: "cv-1", name: "Product CV", status: "archived", profile: { basics: {} }, selections: [],
    });
    const wrapper = await mountEditor();
    await button(wrapper, "Resume Editing Session").trigger("click");
    await flushPromises();
    await button(wrapper, "Archive CV").trigger("click");
    await flushPromises();
    await button(wrapper, "Apply Proposed Changes").trigger("click");
    await flushPromises();
    expect(button(wrapper, "Finish as CV Revision")).toBeUndefined();
    expect(button(wrapper, "Save CV")).toBeUndefined();
    expect(wrapper.text()).not.toContain("Publishing");
    expect(button(wrapper, "Resume Editing Session")).toBeUndefined();
    expect(button(wrapper, "Restore CV")).toBeDefined();
  });

  it("does not offer to restore an Editing Session until its archived CV is restored", async () => {
    cvWorkspace.open.mockResolvedValue({
      id: "cv-1", name: "Product CV", status: "archived", profile: { basics: {} }, selections: [],
    });
    cvWorkspace.editingSessions.mockResolvedValue([{
      id: "session-1", cvId: "cv-1", status: "archived", baseRevisionId: "revision-1",
      baseRevisionNumber: 1, optimisticVersion: 2, name: "Product CV", profile: { basics: {} }, selections: [],
    }]);

    const wrapper = await mountEditor();

    expect(wrapper.text()).toContain("Archived Editing Sessions");
    expect(button(wrapper, "Restore Editing Session")).toBeUndefined();
    expect(button(wrapper, "Restore CV")).toBeDefined();
  });

  it("reviews an exact Revision publication and explicit rollback before apply", async () => {
    cvWorkspace.open.mockResolvedValue({
      id: "cv-1", name: "Product CV", status: "published", slug: "product-cv",
      publishedRevisionId: "revision-2", profile: { basics: {} }, selections: [],
    });
    cvWorkspace.history.mockResolvedValue([
      { id: "revision-2", cvId: "cv-1", number: 2 },
      { id: "revision-1", cvId: "cv-1", number: 1 },
    ]);
    cvWorkspace.proposeLifecycleChange.mockResolvedValue({
      id: "proposal-publish", operationType: "publish_revision", status: "pending",
      target: { type: "cv_revision", id: "revision-1", cvId: "cv-1" },
      diff: { publication: { beforeRevisionId: "revision-2", afterRevisionId: "revision-1" } },
      warnings: ["This rolls back the public CV to Revision 1."], expiresAt: "later",
    });
    const wrapper = await mountEditor();

    await button(wrapper, "Roll back to Revision 1").trigger("click");
    await flushPromises();

    expect(cvWorkspace.proposeLifecycleChange).toHaveBeenCalledWith({ operation: {
      type: "publish_revision",
      target: { type: "cv_revision", id: "revision-1", cvId: "cv-1" },
      slug: "product-cv",
    } });
    expect(cvWorkspace.applyChangeProposal).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("rolls back the public CV");
  });

  it("allows the retained Revision pin to be republished after withdrawal", async () => {
    cvWorkspace.open.mockResolvedValue({
      id: "cv-1", name: "Product CV", status: "draft", slug: "product-cv",
      publishedRevisionId: "revision-2", profile: { basics: {} }, selections: [],
    });
    cvWorkspace.history.mockResolvedValue([
      { id: "revision-2", cvId: "cv-1", number: 2 },
    ]);
    const wrapper = await mountEditor();

    const publish = button(wrapper, "Publish Revision 2");
    expect(publish).toBeDefined();
    expect(publish.attributes("disabled")).toBeUndefined();
  });

  it("resolves a finish retry after the server already committed the Revision", async () => {
    const openSession = {
      id: "session-1",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: "revision-1",
      baseRevisionNumber: 1,
      optimisticVersion: 3,
      name: "Product CV",
      profile: { basics: { name: "Nic" } },
      summary: "Persisted session work",
      selections: [],
    };
    const finishedSession = {
      ...openSession,
      status: "finished",
      optimisticVersion: 5,
      finishedRevisionId: "revision-2",
      revisionNumber: 2,
    };
    let resolveFinishedReload;
    cvWorkspace.history.mockResolvedValue([{
      id: "revision-1",
      cvId: "cv-1",
      number: 1,
      baseRevisionId: null,
    }]);
    cvWorkspace.editingSessions.mockResolvedValue([openSession]);
    cvWorkspace.resumeEditingSession
      .mockResolvedValueOnce(openSession)
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveFinishedReload = resolve;
      }));
    cvWorkspace.saveEditingSession.mockRejectedValue(
      Object.assign(new Error("Editing Session is not open."), {
        code: "session-finished",
      }),
    );
    const wrapper = await mountEditor();

    await button(wrapper, "Resume Editing Session").trigger("click");
    await flushPromises();
    await button(wrapper, "Finish as CV Revision").trigger("click");
    await flushPromises();

    expect(button(wrapper, "Finish as CV Revision").attributes("disabled")).toBeDefined();
    expect(cvWorkspace.finishEditingSession).not.toHaveBeenCalled();

    resolveFinishedReload(finishedSession);
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain(
      "finished as Revision 2",
    );
    expect(button(wrapper, "Finish as CV Revision")).toBeUndefined();
  });

  it("adds, regroups, reorders, removes, and saves exact Block Versions in an Editing Session", async () => {
    blockLibrary.browse.mockResolvedValue({
      blocks: [{
        id: "block-product-launch",
        kind: "experience",
        title: "Product launch",
        contexts: [{
          type: "employment",
          metadata: {
            company: "Google",
            role: "Product Manager",
            startDate: "2024-01",
            endDate: "present",
          },
        }],
        currentVersion: {
          id: "version-product-2",
          number: 2,
          content: { text: "Shipped the current launch." },
          source: { type: "human" },
        },
        versions: [{
          id: "version-product-1",
          number: 1,
          content: { text: "Shipped the original launch." },
          source: { type: "human" },
        }, {
          id: "version-product-2",
          number: 2,
          content: { text: "Shipped the current launch." },
          source: { type: "human" },
        }],
      }],
      experience: [],
      sidebar: {},
    });
    cvWorkspace.open.mockResolvedValue({
      id: "cv-1",
      name: "Product CV",
      themeId: "editorial",
      profile: {
        basics: {
          name: "Nic",
          label: "Product Lead",
          email: "nic@example.com",
        },
      },
      summary: "Existing summary",
      selections: [{
        blockId: "block-analytics",
        versionId: "version-analytics-3",
        section: "skills",
        order: 0,
        content: { name: "Product analytics" },
        block: { title: "Analytics", kind: "skill" },
      }, {
        blockId: "block-sports",
        versionId: "version-sports-1",
        section: "interests",
        order: 0,
        content: { name: "Basketball" },
        block: { title: "Sports", kind: "interest" },
      }],
    });
    const editingSession = {
      id: "session-edit", cvId: "cv-1", baseRevisionId: "revision-1", baseRevisionNumber: 1,
      status: "open", optimisticVersion: 1, name: "Product CV", themeId: "editorial",
      profile: { basics: { name: "Nic", label: "Product Lead", email: "nic@example.com" } },
      summary: "Existing summary",
      selections: [],
    };
    editingSession.selections = (await cvWorkspace.open()).selections;
    cvWorkspace.editingSessions.mockResolvedValue([editingSession]);
    cvWorkspace.resumeEditingSession.mockResolvedValue(editingSession);
    cvWorkspace.saveEditingSession.mockImplementation(async (session) => ({ ...session, optimisticVersion: 2 }));
    const wrapper = await mountEditor();

    await button(wrapper, "Resume Editing Session").trigger("click");
    await flushPromises();

    const libraryRow = wrapper.get(".library-row");
    await libraryRow.get('select[aria-label="Block Version"]').setValue(
      "version-product-1",
    );
    await button(wrapper, "Add Block Version").trigger("click");
    expect(wrapper.get(".editor-controls").text()).toContain("Selected Block Versions");

    let productSelection = wrapper.findAll(".selection").find((item) =>
      item.text().includes("Product launch"));
    await productSelection.get('select[aria-label="CV section"]').setValue("skills");
    productSelection = wrapper.findAll(".selection").find((item) =>
      item.text().includes("Product launch"));
    await productSelection.findAll("button").find((item) => item.text() === "↑").trigger("click");

    const interestSelection = wrapper.findAll(".selection").find((item) =>
      item.text().includes("Sports"));
    await interestSelection.findAll("button").find((item) =>
      item.text() === "Remove").trigger("click");

    await wrapper.get('input[placeholder="Product lead CV"]').setValue(
      "Google Product Manager CV",
    );
    await wrapper.get('input[type="email"]').setValue("product@example.com");
    await wrapper.get(".editor-controls > label select").setValue("modern");
    await button(wrapper, "Save Editing Session").trigger("click");
    await flushPromises();

    const saved = cvWorkspace.saveEditingSession.mock.calls[0][0];
    expect(saved).toMatchObject({
      id: "session-edit",
      cvId: "cv-1",
      name: "Google Product Manager CV",
      themeId: "modern",
      profile: {
        basics: {
          name: "Nic",
          label: "Product Lead",
          email: "product@example.com",
        },
      },
      summary: "Existing summary",
    });
    expect(saved.selections).toEqual([
      expect.objectContaining({
        blockId: "block-product-launch",
        versionId: "version-product-1",
        section: "skills",
        order: 0,
      }),
      expect.objectContaining({
        blockId: "block-analytics",
        versionId: "version-analytics-3",
        section: "skills",
        order: 1,
      }),
    ]);
  });

  it("creates a new CV directly as an initial Editing Session", async () => {
    cvWorkspace.createCvEditingSession.mockResolvedValue({
      id: "session-new", cvId: "cv-new", baseRevisionId: null, status: "open", optimisticVersion: 1,
      name: "New Product CV", profile: { basics: {} }, summary: "", selections: [],
    });
    const wrapper = await mountEditor({ cvId: null });
    await wrapper.get('input[placeholder="Product lead CV"]').setValue("New Product CV");

    await button(wrapper, "Create CV Editing Session").trigger("click");
    await flushPromises();

    expect(cvWorkspace.createCvEditingSession).toHaveBeenCalledWith(expect.objectContaining({
      id: null, name: "New Product CV", selections: [],
    }));
    expect(button(wrapper, "Save Editing Session")).toBeDefined();
    expect(wrapper.get('[role="status"]').text()).toContain("initial Editing Session created");
  });

  it("filters the CV Block Library by type and shows an experience block's parent job", async () => {
    blockLibrary.browse.mockResolvedValue({
      blocks: [{
        id: "block-experience",
        kind: "experience",
        title: "Improved activation",
        contexts: [{
          type: "employment",
          metadata: {
            company: "Google",
            role: "Product Manager",
            startDate: "2024-01",
          },
        }],
        currentVersion: {
          id: "version-experience-1",
          number: 1,
          content: { text: "Improved activation." },
          source: { type: "human" },
        },
        versions: [{
          id: "version-experience-1",
          number: 1,
          content: { text: "Improved activation." },
          source: { type: "human" },
        }],
      }, {
        id: "block-skill",
        kind: "skill",
        title: "Product strategy",
        contexts: [],
        currentVersion: {
          id: "version-skill-1",
          number: 1,
          content: { name: "Product strategy" },
          source: { type: "human" },
        },
        versions: [{
          id: "version-skill-1",
          number: 1,
          content: { name: "Product strategy" },
          source: { type: "human" },
        }],
      }],
      experience: [],
      sidebar: {},
    });

    const wrapper = await mountEditor();

    expect(wrapper.findAll(".library-row")).toHaveLength(2);
    expect(wrapper.findAll(".library-row")[0].text()).toContain("Product Manager at Google");
    expect(wrapper.findAll(".library-row-footer")).toHaveLength(2);
    expect(wrapper.findAll(".library-row-footer select")).toHaveLength(2);
    expect(wrapper.findAll(".library-row-footer button")).toHaveLength(2);

    await button(wrapper, "Skill").trigger("click");

    expect(wrapper.findAll(".library-row")).toHaveLength(1);
    expect(wrapper.get(".library-row").text()).toContain("Product strategy");
    expect(wrapper.get(".library-row").text()).not.toContain("Improved activation");
  });

  it("shows and explicitly replaces an older pinned Block Version", async () => {
    const productBlock = {
      id: "block-product-launch",
      kind: "experience",
      title: "Product launch",
      contexts: [{
        type: "employment",
        metadata: {
          company: "Google",
          role: "Product Manager",
          startDate: "2024-01",
          endDate: "present",
        },
      }],
      currentVersion: {
        id: "version-product-2",
        number: 2,
        content: { text: "Shipped the current launch." },
        source: { type: "human" },
      },
      versions: [{
        id: "version-product-1",
        number: 1,
        content: { text: "Shipped the original launch." },
        source: { type: "human" },
      }, {
        id: "version-product-2",
        number: 2,
        content: { text: "Shipped the current launch." },
        source: { type: "human" },
      }],
    };
    blockLibrary.browse.mockResolvedValue({
      blocks: [productBlock],
      experience: [],
      sidebar: {},
    });
    cvWorkspace.open.mockResolvedValue({
      id: "cv-1",
      name: "Product CV",
      profile: { basics: {} },
      selections: [{
        blockId: "block-product-launch",
        versionId: "version-product-1",
        section: "experience",
        order: 0,
        content: { text: "Shipped the original launch." },
        block: {
          title: "Product launch",
          kind: "experience",
          contexts: productBlock.contexts,
          versionNumber: 1,
        },
      }],
    });
    const wrapper = await mountEditor({
      taskChatStub: {
        props: ["createTasksHandler"],
        template: '<button class="create-reviewed-tasks" @click="createTasksHandler([])">Create reviewed tasks</button>',
      },
    });
    const versionSelect = wrapper.get('.library-row select[aria-label="Block Version"]');
    const replaceButton = button(wrapper, "Replace Block Version");

    expect(versionSelect.element.value).toBe("version-product-1");
    expect(replaceButton.attributes("disabled")).toBeDefined();
    expect(wrapper.get(".selection").text()).toContain("Block Version 1");

    await wrapper.get(".create-reviewed-tasks").trigger("click");
    await flushPromises();
    expect(blockLibrary.browse).toHaveBeenCalledTimes(2);
    expect(versionSelect.element.value).toBe("version-product-1");
    expect(replaceButton.attributes("disabled")).toBeDefined();

    await versionSelect.setValue("version-product-2");
    expect(replaceButton.attributes("disabled")).toBeUndefined();
    await replaceButton.trigger("click");

    expect(wrapper.findAll(".selection")).toHaveLength(1);
    expect(wrapper.get(".selection").text()).toContain("Block Version 2");
    expect(wrapper.get(".live-preview").text()).toContain(
      "Shipped the current launch.",
    );
  });

  it("does not mutate the draft until the proposal is explicitly accepted", async () => {
    cvWorkspace.suggestSummary.mockResolvedValue({
      text: "Generated proposal",
      provenance: { type: "ai", provider: "openrouter" },
    });
    const wrapper = await mountEditor();
    await wrapper.get('input[placeholder="Focus on product leadership"]').setValue("Target a platform role");
    await button(wrapper, "Generate Summary Change Proposal").trigger("click");
    await flushPromises();

    expect(cvWorkspace.suggestSummary).toHaveBeenCalledWith(
      expect.objectContaining({ summary: "Existing summary" }),
      "Target a platform role",
    );
    expect(wrapper.get(".live-preview").text()).toContain("Existing summary");
    expect(wrapper.get(".live-preview").text()).not.toContain("Generated proposal");

    const proposalEditor = wrapper.get('[aria-label="Edit Summary Change Proposal"]');
    await proposalEditor.setValue("Reviewed generated proposal");
    expect(wrapper.get(".live-preview").text()).not.toContain("Reviewed generated proposal");

    await button(wrapper, "Apply Change Proposal").trigger("click");
    expect(wrapper.get(".live-preview").text()).toContain("Reviewed generated proposal");
  });

  it("shows loading and leaves the existing summary unchanged after failure", async () => {
    let rejectRequest;
    cvWorkspace.suggestSummary.mockReturnValue(new Promise((resolve, reject) => {
      rejectRequest = reject;
    }));
    const wrapper = await mountEditor();
    await wrapper.get('input[placeholder="Focus on product leadership"]').setValue("Improve it");
    await button(wrapper, "Generate Summary Change Proposal").trigger("click");

    expect(button(wrapper, "Generate Summary Change Proposal").attributes("aria-busy")).toBe("true");
    expect(button(wrapper, "Generate Summary Change Proposal").attributes("disabled")).toBeDefined();
    rejectRequest(new Error("Connect OpenRouter in AI settings before generating content."));
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain("Connect OpenRouter");
    expect(wrapper.get(".live-preview").text()).toContain("Existing summary");
  });

  it("retains an edited Summary Change Proposal when regeneration fails", async () => {
    cvWorkspace.suggestSummary
      .mockResolvedValueOnce({
        text: "First proposal",
        provenance: { type: "ai", provider: "openrouter" },
      })
      .mockRejectedValueOnce(new Error("OpenRouter is temporarily unavailable."));
    const wrapper = await mountEditor();
    const instruction = wrapper.get('input[placeholder="Focus on product leadership"]');

    await instruction.setValue("First direction");
    await button(wrapper, "Generate Summary Change Proposal").trigger("click");
    await flushPromises();
    await wrapper.get('[aria-label="Edit Summary Change Proposal"]').setValue(
      "Reviewed first proposal",
    );

    await instruction.setValue("Second direction");
    await button(wrapper, "Generate Summary Change Proposal").trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain("temporarily unavailable");
    expect(wrapper.get('[aria-label="Edit Summary Change Proposal"]').element.value).toBe(
      "Reviewed first proposal",
    );
    expect(instruction.element.value).toBe("Second direction");
    expect(wrapper.get(".live-preview").text()).toContain("Existing summary");
  });
});
