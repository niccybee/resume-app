// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CvDraftEditor from "./CvDraftEditor.vue";
import { blockLibrary } from "../services/blockLibrary";
import { cvProfileDefaults } from "../services/cvProfileDefaults";
import { cvWorkspace } from "../services/cvWorkspace";

let route = { params: {}, query: {} };
const replace = vi.fn();

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ replace }),
}));

vi.mock("../services/blockLibrary", () => ({ blockLibrary: { browse: vi.fn() } }));
vi.mock("../services/cvProfileDefaults", () => ({ cvProfileDefaults: { load: vi.fn(), save: vi.fn() } }));
vi.mock("../services/openRouter", () => ({ openRouter: { generateTasks: vi.fn() } }));
vi.mock("../domain/tasks/createTaskBlocks", () => ({ createTaskBlocks: vi.fn() }));
vi.mock("../services/cvWorkspace", () => ({
  cvWorkspace: {
    open: vi.fn(),
    history: vi.fn(),
    editingSessions: vi.fn(),
    resumeEditingSession: vi.fn(),
    saveEditingSession: vi.fn(),
    createCvEditingSession: vi.fn(),
    proposeLifecycleChange: vi.fn(),
    applyChangeProposal: vi.fn(),
    discardChangeProposal: vi.fn(),
    suggestSummary: vi.fn(),
    acceptSummary: vi.fn((draft, proposal) => ({ ...draft, summary: proposal.text })),
  },
}));

const blocks = [{
  id: "block-1",
  kind: "skill",
  title: "Product strategy",
  contexts: [{ type: "sidebar", metadata: {} }],
  currentVersion: { id: "version-2", number: 2, source: { type: "human" }, content: { name: "Product strategy" } },
  versions: [
    { id: "version-1", number: 1, source: { type: "human" }, content: { name: "Roadmapping" } },
    { id: "version-2", number: 2, source: { type: "human" }, content: { name: "Product strategy" } },
  ],
}];

const document = {
  id: "cv-1",
  name: "Product Lead CV",
  status: "draft",
  profile: { basics: { name: "Nic", label: "Product Lead" } },
  selections: [],
};

const session = {
  id: "session-1",
  cvId: "cv-1",
  status: "open",
  optimisticVersion: 3,
  name: "Product Lead CV",
  profile: document.profile,
  selections: [],
};

const passthrough = { template: "<div><slot /><slot name='body' /><slot name='footer' /></div>" };

function mountEditor() {
  return mount(CvDraftEditor, {
    global: {
      stubs: {
        NuxtLink: { props: ["to"], template: '<a :data-to="to"><slot /></a>' },
        UIcon: true,
        UButton: { props: ["loading", "disabled"], template: '<button :disabled="loading || disabled"><slot /></button>' },
        UDropdownMenu: passthrough,
        USlideover: passthrough,
        UModal: passthrough,
        UFormField: passthrough,
        USelectMenu: true,
        TaskChat: true,
        SortableCompositionItem: passthrough,
        DragDropProvider: passthrough,
      },
    },
  });
}

function button(wrapper, label) {
  return wrapper.findAll("button").find((item) => item.text() === label);
}

describe("CV Workbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    route = { params: {}, query: {} };
    blockLibrary.browse.mockResolvedValue({ blocks });
    cvProfileDefaults.load.mockResolvedValue(null);
    cvWorkspace.history.mockResolvedValue([]);
    cvWorkspace.editingSessions.mockResolvedValue([]);
  });

  it("presents a focused new-CV composition with the supporting Block Library", async () => {
    const wrapper = mountEditor();
    await flushPromises();

    expect(wrapper.text()).toContain("CV Workbench");
    expect(wrapper.text()).toContain("Block Library");
    expect(wrapper.text()).toContain("Working Composition");
    expect(wrapper.text()).toContain("Product strategy");
    expect(wrapper.text()).not.toContain("Publishing");
    expect(wrapper.text()).not.toContain("Revision history");
  });

  it("keeps mobile-only library controls out of the desktop button cascade", () => {
    const source = readFileSync(resolve("src/views/CvDraftEditor.vue"), "utf8");

    expect(source).toContain(".library-mobile-close, .mobile-library-button { display: none !important; }");
    expect(source).toContain(".mobile-library-button, .library-mobile-close { display: inline-flex !important; }");
    expect(source).toContain(".cv-workbench--library-collapsed .library-collapse-button");
    expect(source).toContain("aspect-ratio: 1");
    expect(source).toContain("padding: 0 !important");
  });

  it("adds the latest exact Block Version to the Working Composition", async () => {
    const wrapper = mountEditor();
    await flushPromises();

    await button(wrapper, "Add").trigger("click");

    expect(wrapper.text()).toContain("1 selected Block Version");
    await wrapper.findAll(".composition-section-header > button")[1].trigger("click");
    expect(wrapper.text()).toContain("Block Version 2");
  });

  it("opens an existing Editing Session from the overview handoff", async () => {
    route = { params: { cvId: "cv-1" }, query: { session: "session-1" } };
    cvWorkspace.open.mockResolvedValue(document);
    cvWorkspace.editingSessions.mockResolvedValue([session]);
    cvWorkspace.resumeEditingSession.mockResolvedValue(session);

    const wrapper = mountEditor();
    await flushPromises();

    expect(cvWorkspace.resumeEditingSession).toHaveBeenCalledWith("session-1");
    expect(wrapper.text()).toContain("working version 3");
    expect(wrapper.text()).toContain("Saved");
    expect(wrapper.text()).toContain("Finish Revision");
  });

  it("keeps an existing lineage read-only until an Editing Session is chosen", async () => {
    route = { params: { cvId: "cv-1" }, query: {} };
    cvWorkspace.open.mockResolvedValue(document);
    cvWorkspace.editingSessions.mockResolvedValue([session]);

    const wrapper = mountEditor();
    await flushPromises();

    expect(wrapper.text()).toContain("Choose a working version");
    expect(wrapper.text()).toContain("Resume");
    expect(wrapper.text()).not.toContain("Working Composition");
  });

  it("autosaves composition changes without replacing the local Working Composition", async () => {
    vi.useFakeTimers();
    route = { params: { cvId: "cv-1" }, query: { session: "session-1" } };
    cvWorkspace.open.mockResolvedValue(document);
    cvWorkspace.editingSessions.mockResolvedValue([session]);
    cvWorkspace.resumeEditingSession.mockResolvedValue(session);
    cvWorkspace.saveEditingSession.mockImplementation(async (input) => ({
      ...input,
      optimisticVersion: 4,
    }));
    const wrapper = mountEditor();
    await flushPromises();

    await button(wrapper, "Add").trigger("click");
    expect(wrapper.text()).toContain("Saving…");
    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();

    expect(cvWorkspace.saveEditingSession).toHaveBeenCalledWith(expect.objectContaining({
      id: "session-1",
      optimisticVersion: 3,
      selections: [expect.objectContaining({ versionId: "version-2" })],
    }));
    expect(wrapper.text()).toContain("1 selected Block Version");
    expect(wrapper.text()).toContain("Saved");
    vi.useRealTimers();
  });

  it("creates a CV and redirects into its Workbench route", async () => {
    cvWorkspace.createCvEditingSession.mockResolvedValue({ ...session, cvId: "cv-created" });
    cvWorkspace.history.mockResolvedValue([]);
    cvWorkspace.editingSessions.mockResolvedValue([]);
    const wrapper = mountEditor();
    await flushPromises();

    await button(wrapper, "Create CV").trigger("click");
    await flushPromises();

    expect(cvWorkspace.createCvEditingSession).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/app/cvs/cv-created/edit");
  });
});
