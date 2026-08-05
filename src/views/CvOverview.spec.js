// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CvOverview from "./CvOverview.vue";
import { cvWorkspace } from "../services/cvWorkspace";

const push = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { cvId: "cv-1" } }),
  useRouter: () => ({ push }),
}));
vi.mock("../services/cvWorkspace", () => ({
  cvWorkspace: {
    open: vi.fn(),
    history: vi.fn(),
    editingSessions: vi.fn(),
    proposeLifecycleChange: vi.fn(),
    applyChangeProposal: vi.fn(),
    discardChangeProposal: vi.fn(),
  },
}));

function mountOverview() {
  return mount(CvOverview, {
    global: {
      stubs: {
        NuxtLink: { props: ["to"], template: '<a :data-to="to"><slot /></a>' },
        UButton: { props: ["disabled", "loading"], template: '<button :disabled="disabled || loading"><slot /></button>' },
        UInput: { props: ["modelValue"], template: '<input :value="modelValue" />' },
        UFormField: { template: "<label><slot /></label>" },
        UModal: { template: "<div><slot name='body' /><slot name='footer' /></div>" },
      },
    },
  });
}

describe("CV overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cvWorkspace.open.mockResolvedValue({
      id: "cv-1",
      name: "Product Lead CV",
      status: "draft",
      themeId: null,
      profile: { basics: { label: "Product Lead" } },
      selections: [],
    });
    cvWorkspace.history.mockResolvedValue([{ id: "revision-2", cvId: "cv-1", number: 2, baseRevisionNumber: 1 }]);
    cvWorkspace.editingSessions.mockResolvedValue([{ id: "session-1", status: "open", optimisticVersion: 4, baseRevisionNumber: 2 }]);
  });

  it("owns Editing Sessions, immutable Revision history, and publishing", async () => {
    const wrapper = mountOverview();
    await flushPromises();

    expect(wrapper.text()).toContain("Editing Sessions");
    expect(wrapper.text()).toContain("CV Revisions");
    expect(wrapper.text()).toContain("Publishing");
    expect(wrapper.text()).toContain("Revision 2");
  });

  it("hands an open Editing Session to the Workbench", async () => {
    const wrapper = mountOverview();
    await flushPromises();
    await wrapper.findAll("button").find((item) => item.text() === "Resume Workbench").trigger("click");
    expect(push).toHaveBeenCalledWith("/app/cvs/cv-1/edit?session=session-1");
  });
});
