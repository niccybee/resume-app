// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CvDraftEditor from "./CvDraftEditor.vue";
import { createTaskBlocks } from "../domain/tasks/createTaskBlocks";
import { blockLibrary } from "../services/blockLibrary";
import { cvWorkspace } from "../services/cvWorkspace";

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { cvId: "cv-1" } }),
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
    resumeEditingSession: vi.fn(),
    saveEditingSession: vi.fn(),
    finishEditingSession: vi.fn(),
    save: vi.fn(),
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

async function mountEditor({ taskChatStub = true } = {}) {
  const wrapper = mount(CvDraftEditor, {
    global: {
      stubs: {
        NuxtLink: { template: "<a><slot /></a>" },
        TaskChat: taskChatStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("CV summary proposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    cvWorkspace.startEditingSession.mockResolvedValue({
      id: "session-2",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: "revision-2",
      optimisticVersion: 1,
      name: "Product CV",
      profile: { basics: { name: "Nic" } },
      summary: "Revision two",
      selections: [],
    });
    cvWorkspace.resumeEditingSession.mockResolvedValue({
      id: "session-1",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: "revision-1",
      optimisticVersion: 3,
      name: "Product CV",
      profile: { basics: { name: "Nic" } },
      summary: "Persisted session work",
      selections: [],
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
    expect(cvWorkspace.startEditingSession).toHaveBeenCalledWith("cv-1", "revision-2");
    expect(wrapper.text()).toContain("Editing Session based on Revision 2");
  });

  it("starts the first Editing Session for a newly created draft CV", async () => {
    cvWorkspace.history.mockResolvedValue([]);
    cvWorkspace.startEditingSession.mockResolvedValue({
      id: "session-first",
      cvId: "cv-1",
      status: "open",
      baseRevisionId: "revision-1",
      baseRevisionNumber: 1,
      optimisticVersion: 1,
      name: "Product CV",
      profile: { basics: { name: "Nic" } },
      summary: "Existing summary",
      selections: [],
    });
    const wrapper = await mountEditor();

    await button(wrapper, "Start first Editing Session").trigger("click");
    await flushPromises();

    expect(cvWorkspace.startEditingSession).toHaveBeenCalledWith("cv-1", null);
    expect(wrapper.text()).toContain("Editing Session based on Revision 1");
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
    cvWorkspace.finishEditingSession.mockResolvedValue({
      ...summary,
      status: "finished",
      optimisticVersion: 6,
      finishedRevisionId: "revision-2",
      revisionNumber: 2,
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
    expect(cvWorkspace.finishEditingSession).toHaveBeenCalledWith("session-1", 5);
    expect(wrapper.get('[role="status"]').text()).toContain(
      "finished as Revision 2",
    );
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

  it("adds, regroups, reorders, removes, and saves exact Block Versions", async () => {
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
    cvWorkspace.save.mockImplementation(async (draft) => ({ ...draft }));
    const wrapper = await mountEditor();

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
    await button(wrapper, "Save CV").trigger("click");
    await flushPromises();

    const saved = cvWorkspace.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      id: "cv-1",
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
