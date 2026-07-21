// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CvDraftEditor from "./CvDraftEditor.vue";
import { cvWorkspace } from "../services/cvWorkspace";

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { cvId: "cv-1" } }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("../services/blockLibrary", () => ({
  blockLibrary: {
    browse: vi.fn().mockResolvedValue({ blocks: [], experience: [], sidebar: {} }),
  },
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

async function mountEditor() {
  const wrapper = mount(CvDraftEditor, {
    global: {
      stubs: {
        RouterLink: { template: "<a><slot /></a>" },
        TaskChat: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("CV summary proposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cvWorkspace.open.mockResolvedValue({
      id: "cv-1",
      name: "Product CV",
      profile: { basics: { name: "Nic", label: "Product Lead" } },
      summary: "Existing summary",
      selections: [],
    });
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
