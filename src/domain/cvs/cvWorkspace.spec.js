import { describe, expect, it } from "vitest";
import { addSelection, moveSelection, removeSelection } from "./cvDraft";
import { createCvWorkspace } from "./createCvWorkspace";
import { createMemoryCvRepository } from "./createMemoryCvRepository";

const employment = { blockId: "block-1", versionId: "version-1", section: "experience" };
const skill = { blockId: "block-2", versionId: "version-2", section: "skills" };
const employmentContext = {
  type: "employment",
  key: "e2-digital-marketing-manager",
  label: "E2 · Digital Marketing Manager",
  metadata: {
    companyId: "e2",
    company: "E2",
    roleId: "digital-marketing-manager",
    role: "Digital Marketing Manager",
  },
};

describe("CV workspace boundary", () => {
  it("exposes immutable CV Revision history for an existing lineage", async () => {
    const repository = createMemoryCvRepository([{
      id: "cv-1",
      name: "Google Product Manager",
      themeId: "modern",
      summary: "Led product delivery.",
      selections: [employment],
    }]);
    const workspace = createCvWorkspace({ repository });

    const history = await workspace.history("cv-1");
    history[0].summary = "Mutated outside the repository";

    expect(history[0]).toMatchObject({
      cvId: "cv-1",
      number: 1,
      baseRevisionId: null,
    });
    await expect(workspace.history("cv-1")).resolves.toEqual([
      expect.objectContaining({
        number: 1,
        themeId: "modern",
        summary: "Led product delivery.",
      }),
    ]);
  });

  it("resolves a Base Revision to its domain-facing Revision number", async () => {
    const workspace = createCvWorkspace({
      repository: {
        async listRevisions() {
          return [{
            id: "revision-2",
            cvId: "cv-1",
            number: 2,
            baseRevisionId: "revision-1",
          }, {
            id: "revision-1",
            cvId: "cv-1",
            number: 1,
            baseRevisionId: null,
          }];
        },
      },
    });

    await expect(workspace.history("cv-1")).resolves.toEqual([
      expect.objectContaining({ number: 2, baseRevisionNumber: 1 }),
      expect.objectContaining({ number: 1, baseRevisionNumber: null }),
    ]);
  });

  it("composes, saves, and reloads exact block versions", async () => {
    const repository = createMemoryCvRepository();
    const workspace = createCvWorkspace({ repository });
    let draft = { name: "Product CV", selections: [] };
    draft = addSelection(draft, employment);
    draft = addSelection(draft, skill);
    draft = moveSelection(draft, "version-2", "experience", 0);
    draft = removeSelection(draft, "version-1");
    const saved = await workspace.save(draft);
    expect(await workspace.open(saved.id)).toMatchObject({
      name: "Product CV",
      selections: [{ ...skill, section: "experience", order: 0 }],
    });
  });

  it("rejects multiple Block Versions from one CV Block at save and open boundaries", async () => {
    const duplicateSelections = [{
      blockId: "block-1",
      versionId: "version-1",
      section: "experience",
    }, {
      blockId: "block-1",
      versionId: "version-2",
      section: "experience",
    }];
    const workspace = createCvWorkspace({ repository: createMemoryCvRepository() });
    const legacyWorkspace = createCvWorkspace({
      repository: {
        async get() {
          return {
            id: "cv-invalid",
            name: "Invalid legacy CV",
            selections: duplicateSelections,
          };
        },
      },
    });

    await expect(workspace.save({
      name: "Product CV",
      selections: duplicateSelections,
    })).rejects.toMatchObject({
      code: "duplicate-block-selection",
    });
    await expect(legacyWorkspace.open("cv-invalid")).rejects.toMatchObject({
      code: "duplicate-block-selection",
    });
  });

  it("rejects malformed exact selections at save and open boundaries", async () => {
    const workspace = createCvWorkspace({ repository: createMemoryCvRepository() });
    const legacyWorkspace = createCvWorkspace({
      repository: {
        async get() {
          return {
            id: "cv-invalid",
            name: "Invalid legacy CV",
            selections: [{
              blockId: "block-1",
              versionId: "version-1",
              section: "unsupported",
            }],
          };
        },
      },
    });

    await expect(workspace.save({
      name: "Product CV",
      selections: [{ versionId: "version-1", section: "experience" }],
    })).rejects.toMatchObject({ code: "invalid-selection" });
    await expect(legacyWorkspace.open("cv-invalid")).rejects.toMatchObject({
      code: "invalid-section",
    });
  });

  it("preserves employer grouping when an experience version is saved and reloaded", async () => {
    const repository = createMemoryCvRepository();
    const workspace = createCvWorkspace({ repository });
    const draft = addSelection(
      { name: "Marketing CV", selections: [] },
      {
        ...employment,
        content: { text: "Led a cross-functional CRM migration." },
        block: {
          title: "CRM migration leadership",
          contexts: [employmentContext],
        },
      },
    );

    const saved = await workspace.save(draft);

    expect(await workspace.open(saved.id)).toMatchObject({
      selections: [
        {
          blockId: "block-1",
          versionId: "version-1",
          group: {
            employerId: "e2",
            employer: "E2",
            roleId: "digital-marketing-manager",
            role: "Digital Marketing Manager",
          },
        },
      ],
    });
  });

  it("preserves separate employment occasions at the same employer", async () => {
    const repository = createMemoryCvRepository();
    const workspace = createCvWorkspace({ repository });
    const earlierContext = {
      ...employmentContext,
      key: "e2-digital-marketing-manager-2021-03",
      metadata: {
        ...employmentContext.metadata,
        occasionId: "e2-digital-marketing-manager-2021-03",
        startDate: "2021-03",
        endDate: "2022-06",
      },
    };
    const currentContext = {
      ...employmentContext,
      key: "e2-digital-marketing-manager-2024-02",
      metadata: {
        ...employmentContext.metadata,
        occasionId: "e2-digital-marketing-manager-2024-02",
        startDate: "2024-02",
        endDate: "present",
      },
    };
    let draft = addSelection(
      { name: "Marketing CV", selections: [] },
      {
        blockId: "block-earlier",
        versionId: "version-earlier",
        section: "experience",
        block: { contexts: [earlierContext] },
        content: { text: "Led lifecycle reporting." },
      },
    );
    draft = addSelection(draft, {
      blockId: "block-current",
      versionId: "version-current",
      section: "experience",
      block: { contexts: [currentContext] },
      content: { text: "Rebuilt acquisition planning." },
    });

    const saved = await workspace.save(draft);
    const reopened = await workspace.open(saved.id);

    expect(reopened.selections.map((selection) => selection.group)).toEqual([
      expect.objectContaining({
        occasionId: "e2-digital-marketing-manager-2021-03",
        startDate: "2021-03",
        endDate: "2022-06",
      }),
      expect.objectContaining({
        occasionId: "e2-digital-marketing-manager-2024-02",
        startDate: "2024-02",
        endDate: "present",
      }),
    ]);
  });

  it("previews a private draft without publishing it", async () => {
    const repository = createMemoryCvRepository([{ id: "cv-1", name: "Private", selections: [] }]);
    const workspace = createCvWorkspace({ repository });
    expect(await workspace.preview("cv-1")).toMatchObject({ preview: true, status: "draft" });
    expect(await workspace.getPublic("private")).toBeNull();
  });

  it("publishes uniquely and unpublishes without deleting", async () => {
    const repository = createMemoryCvRepository([
      { id: "cv-1", name: "Product CV", selections: [] },
      { id: "cv-2", name: "Other", slug: "other", status: "published", selections: [] },
    ]);
    const workspace = createCvWorkspace({ repository });
    await expect(workspace.publish("cv-1", "other")).rejects.toMatchObject({ code: "slug-conflict" });
    await workspace.publish("cv-1", "Product Lead CV");
    expect(await workspace.getPublic("product-lead-cv")).toMatchObject({ id: "cv-1" });
    await workspace.unpublish("cv-1");
    expect(await workspace.getPublic("product-lead-cv")).toBeNull();
    expect(await workspace.open("cv-1")).toMatchObject({ id: "cv-1", status: "draft" });
  });

  it("keeps generated summaries as proposals until accepted", async () => {
    const repository = createMemoryCvRepository();
    const workspace = createCvWorkspace({
      repository,
      summaryGenerator: {
        name: "fake-ai",
        async suggest() {
          return {
            text: "A focused product leader.",
            model: "test-model-v1",
            createdAt: "2026-07-21T01:00:00.000Z",
          };
        },
      },
    });
    const draft = { name: "Product CV", summary: "Existing", selections: [] };
    const proposal = await workspace.suggestSummary(draft, "Focus on leadership");
    expect(draft.summary).toBe("Existing");
    expect(workspace.acceptSummary(draft, proposal)).toMatchObject({
      summary: "A focused product leader.",
      summaryProvenance: {
        type: "ai",
        provider: "fake-ai",
        model: "test-model-v1",
        createdAt: "2026-07-21T01:00:00.000Z",
      },
    });
  });
});
