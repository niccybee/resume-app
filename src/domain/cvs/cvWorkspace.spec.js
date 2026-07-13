import { describe, expect, it } from "vitest";
import { addSelection, moveSelection, removeSelection } from "./cvDraft";
import { createCvWorkspace } from "./createCvWorkspace";
import { createMemoryCvRepository } from "./createMemoryCvRepository";

const employment = { blockId: "block-1", versionId: "version-1", section: "experience" };
const skill = { blockId: "block-2", versionId: "version-2", section: "skills" };

describe("CV workspace boundary", () => {
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
        async suggest() { return { text: "A focused product leader." }; },
      },
    });
    const draft = { name: "Product CV", summary: "Existing", selections: [] };
    const proposal = await workspace.suggestSummary(draft, "Focus on leadership");
    expect(draft.summary).toBe("Existing");
    expect(workspace.acceptSummary(draft, proposal)).toMatchObject({
      summary: "A focused product leader.",
      summaryProvenance: { type: "ai", provider: "fake-ai" },
    });
  });
});
