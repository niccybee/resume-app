// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CVList from "./CVList.vue";
import { cvWorkspace } from "../services/cvWorkspace";

vi.mock("../services/cvWorkspace", () => ({
  cvWorkspace: { list: vi.fn() },
}));

function mountList() {
  return mount(CVList, {
    global: {
      stubs: {
        NuxtLink: {
          props: ["to"],
          template: '<a :data-to="to"><slot /></a>',
        },
      },
    },
  });
}

describe("native CV list interactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists existing CVs and opens their editor or private preview", async () => {
    cvWorkspace.list.mockResolvedValue([{
      id: "cv-product",
      name: "Google Product Manager CV",
      status: "draft",
      themeId: "modern",
    }]);

    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.text()).toContain("Google Product Manager CV");
    expect(wrapper.get('[data-to="/app/cvs/cv-product"]').text()).toBe("Edit CV");
    expect(wrapper.get('[data-to="/app/cvs/cv-product/preview"]').text()).toBe(
      "Private preview",
    );
  });

  it("uses CV Block language in the empty state", async () => {
    cvWorkspace.list.mockResolvedValue([]);

    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.text()).toContain("Create a role-focused CV from your CV Blocks.");
  });
});
