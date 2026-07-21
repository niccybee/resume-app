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
  const wrapper = mount(BlockLibraryView);
  await flushPromises();
  return wrapper;
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

  it("creates a CV Block through the existing domain boundary", async () => {
    const wrapper = await mountLibrary();
    const form = wrapper.get(".create-panel form");

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
  });

  it("duplicates, archives, restores, and safely deletes CV Blocks", async () => {
    const archived = { ...interestBlock, status: "archived", id: "block-archived", title: "Archived interest" };
    mocks.browse.mockResolvedValue({ ...catalog, blocks: [...catalog.blocks, archived] });
    mocks.duplicateBlock.mockResolvedValue({ blockId: "block-copy" });
    mocks.archiveBlock.mockResolvedValue({ id: experienceBlock.id, status: "archived" });
    mocks.restoreBlock.mockResolvedValue({ id: archived.id, status: "active" });
    mocks.deleteBlock.mockResolvedValue({ deletedBlockId: skillBlock.id });
    const wrapper = mount(BlockLibraryView);
    await flushPromises();

    const click = async (label) => {
      await wrapper.findAll("button").find((item) => item.text() === label).trigger("click");
      await flushPromises();
    };
    await click("Duplicate CV Block");
    await click("Archive CV Block");
    await click("Delete CV Block");
    await click("Restore CV Block");

    expect(mocks.browse).toHaveBeenCalledWith({ includeArchived: true });
    expect(mocks.duplicateBlock).toHaveBeenCalledWith(experienceBlock.id);
    expect(mocks.archiveBlock).toHaveBeenCalledWith(experienceBlock.id);
    expect(mocks.deleteBlock).toHaveBeenCalledWith(experienceBlock.id);
    expect(mocks.restoreBlock).toHaveBeenCalledWith(archived.id);
  });

  it("offers archive recovery when a referenced CV Block cannot be deleted", async () => {
    mocks.deleteBlock.mockRejectedValue(Object.assign(new Error("CV Block is referenced. Archive it instead."), {
      code: "block-referenced", context: { nextActions: ["archive"] },
    }));
    const wrapper = await mountLibrary();

    await wrapper.findAll("button").find((item) => item.text() === "Delete CV Block").trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain("Archive it instead");
    expect(wrapper.text()).toContain("Archive CV Block");
  });

  it("refreshes the current Block Version after a stale conflict before retrying", async () => {
    mocks.saveVersion.mockRejectedValueOnce(
      Object.assign(new Error("This CV Block changed since you opened it. Reload and try again."), {
        code: "conflict",
      }),
    );
    const wrapper = await mountLibrary();
    const editButton = wrapper.findAll("button").find((button) =>
      button.text().includes("Edit & Block Versions"));

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
      button.text().includes("Save immutable Block Version")).trigger("click");
    await flushPromises();

    expect(mocks.saveVersion).toHaveBeenCalledWith(expect.objectContaining({
      blockId: "block-experience",
      basedOnVersionId: "version-experience-1",
      content: { text: "Updated launch evidence." },
    }));
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "changed since you opened it",
    );

    await dialog.findAll("button").find((button) =>
      button.text().includes("Save immutable Block Version")).trigger("click");
    await flushPromises();

    expect(mocks.saveVersion).toHaveBeenLastCalledWith(expect.objectContaining({
      blockId: "block-experience",
      basedOnVersionId: "version-experience-2",
      content: { text: "Updated launch evidence." },
    }));
  });

  it("closes the stale editor when the latest Block Version cannot be loaded", async () => {
    mocks.saveVersion.mockRejectedValueOnce(
      Object.assign(new Error("This CV Block changed since you opened it."), {
        code: "conflict",
      }),
    );
    const wrapper = await mountLibrary();
    mocks.browse.mockRejectedValueOnce(new Error("Network unavailable"));

    await wrapper.findAll("button").find((button) =>
      button.text().includes("Edit & Block Versions")).trigger("click");
    const dialog = wrapper.get("dialog");
    await dialog.get("textarea").setValue("A stale change.");
    await dialog.findAll("button").find((button) =>
      button.text().includes("Save immutable Block Version")).trigger("click");
    await flushPromises();

    expect(dialog.attributes("open")).toBeUndefined();
    expect(mocks.saveVersion).toHaveBeenCalledOnce();
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

    await wrapper.findAll("button").find((button) =>
      button.text().includes("Edit & Block Versions")).trigger("click");
    const dialog = wrapper.get("dialog");
    await dialog.get('input[placeholder="Emphasise stakeholder leadership…"]').setValue(
      "Emphasise market reach",
    );
    await dialog.findAll("button").find((button) =>
      button.text() === "Generate Change Proposal").trigger("click");
    await flushPromises();

    expect(dialog.text()).toContain("Unsaved Change Proposal");
    await dialog.findAll("button").find((button) =>
      button.text() === "Apply as new Block Version").trigger("click");
    await flushPromises();

    expect(mocks.saveVersion).toHaveBeenCalledWith(expect.objectContaining({
      blockId: "block-experience",
      basedOnVersionId: "version-experience-1",
      content: { text: "Led a product launch across three markets." },
      source: { type: "ai", generator: "openrouter" },
    }));
  });
});
