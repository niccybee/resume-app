// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BlockLibraryView from "./BlockLibraryView.vue";

const mocks = vi.hoisted(() => ({
  browse: vi.fn(),
  saveVersion: vi.fn(),
  suggestVersion: vi.fn(),
  duplicateBlock: vi.fn(),
  archiveBlock: vi.fn(),
  restoreBlock: vi.fn(),
  deleteBlock: vi.fn(),
  backfill: vi.fn(),
  listCvs: vi.fn(),
  editingSessions: vi.fn(),
  proposeContentChanges: vi.fn(),
  proposeLifecycleChange: vi.fn(),
  applyChangeProposal: vi.fn(),
  discardChangeProposal: vi.fn(),
}));

vi.mock("../services/blockLibrary", () => ({
  blockLibrary: {
    browse: mocks.browse,
    saveVersion: mocks.saveVersion,
    suggestVersion: mocks.suggestVersion,
    duplicateBlock: mocks.duplicateBlock,
    archiveBlock: mocks.archiveBlock,
    restoreBlock: mocks.restoreBlock,
    deleteBlock: mocks.deleteBlock,
  },
}));

vi.mock("../domain/blocks/backfillLegacyHomepageBlocks", () => ({
  backfillLegacyHomepageBlocks: mocks.backfill,
}));

vi.mock("../services/cvWorkspace", () => ({
  cvWorkspace: {
    list: mocks.listCvs,
    editingSessions: mocks.editingSessions,
    proposeContentChanges: mocks.proposeContentChanges,
    proposeLifecycleChange: mocks.proposeLifecycleChange,
    applyChangeProposal: mocks.applyChangeProposal,
    discardChangeProposal: mocks.discardChangeProposal,
  },
}));

const experienceBlock = {
  id: "block-experience",
  kind: "experience",
  title: "Product launch",
  status: "active",
  contexts: [{
    type: "employment",
    metadata: {
      companyId: "google",
      company: "Google",
      roleId: "product-manager",
      role: "Product Manager",
      occasionId: "google-product-manager-2024",
    },
  }],
  currentVersion: {
    id: "version-experience-1",
    number: 1,
    content: { text: "Launched a new product." },
    source: { type: "human" },
  },
  versions: [{
    id: "version-experience-1",
    number: 1,
    content: { text: "Launched a new product." },
    source: { type: "human" },
  }],
};

const earlierExperienceBlock = {
  ...experienceBlock,
  id: "block-experience-earlier",
  title: "Earlier product work",
  contexts: [{
    type: "employment",
    metadata: {
      company: "Google",
      role: "Product Manager",
      startDate: "2021-01",
      endDate: "2022-12",
    },
  }],
  currentVersion: {
    ...experienceBlock.currentVersion,
    id: "version-experience-earlier-1",
    content: { text: "Improved an earlier product." },
  },
  versions: [{
    ...experienceBlock.versions[0],
    id: "version-experience-earlier-1",
    content: { text: "Improved an earlier product." },
  }],
};

const skillBlock = {
  id: "block-skill",
  kind: "skill",
  title: "Analytics",
  status: "active",
  contexts: [{ type: "sidebar", key: "skills", metadata: {} }],
  currentVersion: {
    id: "version-skill-1",
    number: 1,
    content: { name: "Product analytics" },
    source: { type: "human" },
  },
  versions: [{
    id: "version-skill-1",
    number: 1,
    content: { name: "Product analytics" },
    source: { type: "human" },
  }],
};

const interestBlock = {
  ...skillBlock,
  id: "block-interest",
  kind: "interest",
  title: "Sports",
  contexts: [{ type: "sidebar", key: "interests", metadata: {} }],
  currentVersion: {
    ...skillBlock.currentVersion,
    id: "version-interest-1",
    content: { name: "Basketball" },
  },
  versions: [{
    ...skillBlock.versions[0],
    id: "version-interest-1",
    content: { name: "Basketball" },
  }],
};

const catalog = {
  blocks: [experienceBlock, earlierExperienceBlock, skillBlock, interestBlock],
  experience: [{
    employerId: "google",
    employer: "Google",
    occasions: [{
      occasionId: "google-product-manager-2024",
      roleId: "product-manager",
      role: "Product Manager",
      startDate: "2024-01",
      endDate: "present",
      blocks: [experienceBlock],
    }, {
      occasionId: "google-product-manager-2021-01",
      roleId: "product-manager",
      role: "Product Manager",
      startDate: "2021-01",
      endDate: "2022-12",
      blocks: [earlierExperienceBlock],
    }],
  }],
  sidebar: { skills: [skillBlock], interests: [interestBlock] },
};

async function mountLibrary() {
  mocks.browse.mockResolvedValue(catalog);
  mocks.listCvs.mockResolvedValue([{ id: "cv-1", name: "Product Manager at Google" }]);
  mocks.editingSessions.mockResolvedValue([{
    id: "session-1", cvId: "cv-1", status: "open", optimisticVersion: 2,
  }]);
  mocks.proposeContentChanges.mockResolvedValue({
    id: "proposal-1", status: "pending", baseOptimisticVersion: 2,
  });
  mocks.applyChangeProposal.mockResolvedValue({ id: "proposal-1", status: "applied" });
  mocks.discardChangeProposal.mockResolvedValue({ id: "proposal-1", status: "discarded" });
  mocks.proposeLifecycleChange.mockImplementation(async ({ operation }) => ({
    id: `proposal-${operation.type}`,
    operationType: operation.type,
    status: "pending",
  }));
  const wrapper = mountBlockLibrary();
  await flushPromises();
  return wrapper;
}

function mountBlockLibrary() {
  return mount(BlockLibraryView, {
    global: {
      stubs: {
        UButton: {
          props: ["icon"],
          template: '<button><span v-if="icon" :data-icon="icon" /><slot /></button>',
        },
        UCard: {
          props: ["as"],
          template: '<component :is="as || \'div\'" class="block-card"><div data-slot="body"><slot /></div><div data-slot="footer"><slot name="footer" /></div></component>',
        },
        UCommandPalette: {
          props: ["searchTerm", "placeholder"],
          emits: ["update:searchTerm", "update:open"],
          template: `
            <div class="command-palette-stub">
              <input
                type="search"
                aria-label="Search CV Blocks, employers, roles…"
                :placeholder="placeholder"
                :value="searchTerm"
                @input="$emit('update:searchTerm', $event.target.value)"
              />
              <slot name="footer" />
            </div>
          `,
        },
        UIcon: {
          props: ["name"],
          template: '<span :data-icon="name" />',
        },
        UKbd: {
          props: ["value"],
          template: '<kbd>{{ value }}</kbd>',
        },
        UModal: {
          props: ["open", "title"],
          emits: ["update:open"],
          template: '<div v-if="open" role="dialog" :aria-label="title"><slot name="body" /><slot name="footer" /></div>',
        },
        UTooltip: {
          props: ["text"],
          template: '<span class="tooltip-stub" :data-tooltip="text"><slot /></span>',
        },
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("native CV Block Library interactions", () => {
  it("composes search, kind, employer, role, Employment Occasion, and sidebar filters", async () => {
    const wrapper = await mountLibrary();

    expect(mocks.browse).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("Launched a new product.");
    expect(wrapper.text()).toContain("Product analytics");
    expect(wrapper.text()).toContain("Improved an earlier product.");
    expect(wrapper.text()).toContain("Basketball");
    expect(wrapper.findAll('.block-card [data-slot="footer"]')).toHaveLength(4);
    expect(wrapper.find('.block-card [data-slot="footer"]').text()).toContain("1 Block Version");
    expect(wrapper.findAll(".block-actions button").every((button) =>
      button.classes().includes("secondary"))).toBe(true);

    await wrapper.get('button[aria-label="Search CV Blocks"]').trigger("click");
    await wrapper.get('input[type="search"]').setValue("analytics");
    expect(wrapper.text()).not.toContain("Launched a new product.");
    expect(wrapper.text()).toContain("Product analytics");

    await wrapper.get('input[type="search"]').setValue("");
    const filters = wrapper.findAll(".library-tools select");
    await filters[0].setValue("experience");
    await filters[1].setValue("google");
    await filters[2].setValue("product-manager");
    expect(wrapper.text()).toContain("Launched a new product.");
    expect(wrapper.text()).toContain("Improved an earlier product.");
    expect(wrapper.text()).not.toContain("Product analytics");

    await filters[3].setValue("google-product-manager-2024");
    expect(wrapper.text()).toContain("Launched a new product.");
    expect(wrapper.text()).not.toContain("Improved an earlier product.");

    await filters[0].setValue("");
    await filters[1].setValue("");
    await filters[2].setValue("");
    await filters[3].setValue("");
    await filters[4].setValue("interests");
    expect(wrapper.text()).toContain("Basketball");
    expect(wrapper.text()).not.toContain("Product analytics");
    expect(wrapper.text()).not.toContain("Launched a new product.");
  });

  it("opens the CV Block command bar from the search icon and Meta+K", async () => {
    const wrapper = await mountLibrary();

    expect(wrapper.find('[role="dialog"][aria-label="Search CV Blocks"]').exists()).toBe(false);
    const trigger = wrapper.get('button[aria-label="Search CV Blocks"]');
    expect(trigger.attributes("aria-keyshortcuts")).toBe("Meta+K");

    await trigger.trigger("click");
    expect(wrapper.get('[role="dialog"][aria-label="Search CV Blocks"]').exists()).toBe(true);

    await wrapper.get('[role="dialog"][aria-label="Search CV Blocks"] button[aria-label="Close search"]').trigger("click");
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));
    await flushPromises();

    expect(wrapper.get('[role="dialog"][aria-label="Search CV Blocks"]').exists()).toBe(true);
  });

  it("creates a CV Block through the existing domain boundary", async () => {
    const wrapper = await mountLibrary();
    await wrapper.get('button[aria-label="Create CV Block"]').trigger("click");
    const form = wrapper.get("form.create-panel");

    expect(wrapper.text()).toContain("Create CV Block");
    await form.get("select").setValue("skill");
    await form.get('input[required]').setValue("Experimentation");
    await form.get("textarea").setValue("A/B testing");
    await form.trigger("submit");
    await flushPromises();

    expect(mocks.saveVersion).toHaveBeenCalledWith({
      kind: "skill",
      title: "Experimentation",
      content: { name: "A/B testing" },
      contexts: [{
        type: "sidebar",
        key: "skills",
        label: "Experimentation",
        metadata: {},
      }],
    });
    expect(wrapper.find('[role="dialog"][aria-label="Create CV Block"]').exists()).toBe(false);
  });

  it("duplicates, archives, restores, and safely deletes CV Blocks", async () => {
    const archived = { ...interestBlock, status: "archived", id: "block-archived", title: "Archived interest" };
    mocks.browse.mockResolvedValue({ ...catalog, blocks: [...catalog.blocks, archived] });
    mocks.duplicateBlock.mockResolvedValue({ blockId: "block-copy" });
    mocks.deleteBlock.mockResolvedValue({ deletedBlockId: skillBlock.id });
    const wrapper = mountBlockLibrary();
    await flushPromises();

    const click = async (label) => {
      const target = wrapper.findAll("button").find((button) =>
        button.attributes("aria-label") === label || button.text() === label);
      await target.trigger("click");
      await flushPromises();
    };
    await click("Duplicate CV Block");
    await click("Archive CV Block");
    await click("Apply reviewed Change Proposal");
    await click("Delete CV Block");
    await click("Restore CV Block");
    await click("Apply reviewed Change Proposal");

    expect(mocks.browse).toHaveBeenCalledWith({ includeArchived: true });
    expect(mocks.duplicateBlock).toHaveBeenCalledWith(experienceBlock.id);
    expect(mocks.proposeLifecycleChange).toHaveBeenCalledWith({ operation: {
      type: "archive_cv_block", target: { type: "cv_block", id: experienceBlock.id },
      baseVersionId: experienceBlock.currentVersion.id,
    } });
    expect(mocks.deleteBlock).toHaveBeenCalledWith(experienceBlock.id);
    expect(mocks.proposeLifecycleChange).toHaveBeenCalledWith({ operation: {
      type: "restore_cv_block", target: { type: "cv_block", id: archived.id },
      baseVersionId: archived.currentVersion.id,
    } });
  });

  it("offers archive recovery when a referenced CV Block cannot be deleted", async () => {
    mocks.deleteBlock.mockRejectedValue(Object.assign(new Error("CV Block is referenced. Archive it instead."), {
      code: "block-referenced", context: { nextActions: ["archive"] },
    }));
    const wrapper = await mountLibrary();

    await wrapper.get('button[aria-label="Delete CV Block"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain("Archive it instead");
    expect(wrapper.find('button[aria-label="Archive CV Block"]').exists()).toBe(true);
  });

  it("refreshes the current Block Version after a stale conflict before retrying", async () => {
    mocks.proposeContentChanges.mockRejectedValueOnce(
      Object.assign(new Error("This CV Block changed since you opened it. Reload and try again."), {
        code: "stale-block-version",
      }),
    );
    const wrapper = await mountLibrary();
    const editButton = wrapper.get('button[aria-label="Edit & Block Versions"]');

    const refreshedExperienceBlock = {
      ...experienceBlock,
      currentVersion: {
        id: "version-experience-2",
        number: 2,
        content: { text: "A concurrent update." },
        source: { type: "human" },
      },
      versions: [
        ...experienceBlock.versions,
        {
          id: "version-experience-2",
          number: 2,
          content: { text: "A concurrent update." },
          source: { type: "human" },
        },
      ],
    };
    mocks.browse.mockResolvedValueOnce({
      ...catalog,
      blocks: [refreshedExperienceBlock, earlierExperienceBlock, skillBlock, interestBlock],
      experience: [{
        ...catalog.experience[0],
        occasions: [{
          ...catalog.experience[0].occasions[0],
          blocks: [refreshedExperienceBlock],
        }, catalog.experience[0].occasions[1]],
      }],
    });

    await editButton.trigger("click");
    const dialog = wrapper.get("dialog");
    await dialog.get("textarea").setValue("Updated launch evidence.");
    await dialog.findAll("button").find((button) =>
      button.text().includes("Review Block Version Change")).trigger("click");
    await flushPromises();

    expect(mocks.proposeContentChanges).toHaveBeenCalledWith(expect.objectContaining({
      target: { type: "editing_session", id: "session-1" },
      baseVersion: 2,
      operations: [expect.objectContaining({
        blockId: "block-experience",
        basedOnVersionId: "version-experience-1",
        content: { text: "Updated launch evidence." },
      })],
    }));
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "changed since you opened it",
    );

    await dialog.findAll("button").find((button) =>
      button.text().includes("Review Block Version Change")).trigger("click");
    await flushPromises();

    expect(mocks.proposeContentChanges).toHaveBeenLastCalledWith(expect.objectContaining({
      operations: [expect.objectContaining({
        blockId: "block-experience",
        basedOnVersionId: "version-experience-2",
        content: { text: "Updated launch evidence." },
      })],
    }));
  });

  it("closes the stale editor when the latest Block Version cannot be loaded", async () => {
    mocks.proposeContentChanges.mockRejectedValueOnce(
      Object.assign(new Error("This CV Block changed since you opened it."), {
        code: "stale-block-version",
      }),
    );
    const wrapper = await mountLibrary();
    mocks.browse.mockRejectedValueOnce(new Error("Network unavailable"));

    await wrapper.get('button[aria-label="Edit & Block Versions"]').trigger("click");
    const dialog = wrapper.get("dialog");
    await dialog.get("textarea").setValue("A stale change.");
    await dialog.findAll("button").find((button) =>
      button.text().includes("Review Block Version Change")).trigger("click");
    await flushPromises();

    expect(dialog.attributes("open")).toBeUndefined();
    expect(mocks.proposeContentChanges).toHaveBeenCalledOnce();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "latest Block Version could not be loaded",
    );
  });

  it("presents and explicitly applies an AI Change Proposal", async () => {
    mocks.suggestVersion.mockResolvedValue({
      content: { text: "Led a product launch across three markets." },
      source: { type: "ai", generator: "openrouter" },
    });
    const wrapper = await mountLibrary();

    await wrapper.get('button[aria-label="Edit & Block Versions"]').trigger("click");
    const dialog = wrapper.get("dialog");
    await dialog.get('input[placeholder="Emphasise stakeholder leadership…"]').setValue(
      "Emphasise market reach",
    );
    await dialog.findAll("button").find((button) =>
      button.text() === "Generate Change Proposal").trigger("click");
    await flushPromises();

    expect(dialog.text()).toContain("Unsaved Change Proposal");
    await dialog.findAll("button").find((button) =>
      button.text() === "Review as Change Proposal").trigger("click");
    await flushPromises();

    expect(mocks.proposeContentChanges).toHaveBeenCalledWith(expect.objectContaining({
      operations: [expect.objectContaining({
        blockId: "block-experience",
        basedOnVersionId: "version-experience-1",
        content: { text: "Led a product launch across three markets." },
        source: { type: "ai", generator: "openrouter" },
      })],
    }));
    expect(mocks.applyChangeProposal).not.toHaveBeenCalled();

    await dialog.findAll("button").find((button) =>
      button.text() === "Apply reviewed Change Proposal").trigger("click");
    await flushPromises();

    expect(mocks.applyChangeProposal).toHaveBeenCalledWith("proposal-1");
  });

  it("discards a reviewed Block Version Change Proposal without applying it", async () => {
    const wrapper = await mountLibrary();
    await wrapper.get('button[aria-label="Edit & Block Versions"]').trigger("click");
    await flushPromises();
    const dialog = wrapper.get("dialog");
    await dialog.findAll("button").find((button) =>
      button.text() === "Review Block Version Change").trigger("click");
    await flushPromises();

    await dialog.findAll("button").find((button) =>
      button.text() === "Discard reviewed Change Proposal").trigger("click");
    await flushPromises();

    expect(mocks.discardChangeProposal).toHaveBeenCalledWith("proposal-1");
    expect(mocks.applyChangeProposal).not.toHaveBeenCalled();
    expect(dialog.find('[aria-label="Reviewed Block Version Change Proposal"]').exists()).toBe(false);
  });
});
