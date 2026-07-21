// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CvPreview from "./CvPreview.vue";
import { cvWorkspace } from "../services/cvWorkspace";

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { cvId: "cv-private" } }),
}));

vi.mock("../services/cvWorkspace", () => ({
  cvWorkspace: { preview: vi.fn() },
}));

describe("native private CV preview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders an owned draft composition without publishing it", async () => {
    cvWorkspace.preview.mockResolvedValue({
      id: "cv-private",
      name: "Private Product CV",
      status: "draft",
      preview: true,
      profile: { basics: { name: "Nic", label: "Product Manager" } },
      summary: "A private role-focused summary.",
      selections: [{
        blockId: "block-1",
        versionId: "version-2",
        section: "experience",
        order: 0,
        content: { text: "Shipped a private product launch." },
        block: { title: "Product launch", kind: "experience" },
      }],
    });

    const wrapper = mount(CvPreview, {
      global: {
        stubs: {
          NuxtLink: {
            props: ["to"],
            template: '<a :data-to="to"><slot /></a>',
          },
        },
      },
    });
    await flushPromises();

    expect(cvWorkspace.preview).toHaveBeenCalledWith("cv-private");
    expect(wrapper.text()).toContain("A private role-focused summary.");
    expect(wrapper.text()).toContain("Shipped a private product launch.");
    expect(wrapper.get('[data-to="/app/cvs/cv-private"]').text()).toContain(
      "Back to editor",
    );
    expect(wrapper.text()).not.toContain("Publish");
  });
});
