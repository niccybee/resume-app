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
        RouterLink: { template: "<a><slot /></a>" },
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
    cvWorkspace.open.mockResolvedValue({
      id: "cv-1",
      name: "Product CV",
      profile: { basics: { name: "Nic", label: "Product Lead" } },
      summary: "Existing summary",
      selections: [],
    });
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
    await button(wrapper, "Generate proposal").trigger("click");
    await flushPromises();

    expect(cvWorkspace.suggestSummary).toHaveBeenCalledWith(
      expect.objectContaining({ summary: "Existing summary" }),
      "Target a platform role",
    );
    expect(wrapper.get(".live-preview").text()).toContain("Existing summary");
    expect(wrapper.get(".live-preview").text()).not.toContain("Generated proposal");

    await button(wrapper, "Accept").trigger("click");
    expect(wrapper.get(".live-preview").text()).toContain("Generated proposal");
  });

  it("shows loading and leaves the existing summary unchanged after failure", async () => {
    let rejectRequest;
    cvWorkspace.suggestSummary.mockReturnValue(new Promise((resolve, reject) => {
      rejectRequest = reject;
    }));
    const wrapper = await mountEditor();
    await wrapper.get('input[placeholder="Focus on product leadership"]').setValue("Improve it");
    await button(wrapper, "Generate proposal").trigger("click");

    expect(button(wrapper, "Generate proposal").attributes("aria-busy")).toBe("true");
    expect(button(wrapper, "Generate proposal").attributes("disabled")).toBeDefined();
    rejectRequest(new Error("Connect OpenRouter in AI settings before generating content."));
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain("Connect OpenRouter");
    expect(wrapper.get(".live-preview").text()).toContain("Existing summary");
  });
});
