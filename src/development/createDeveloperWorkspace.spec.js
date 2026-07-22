import { describe, expect, it } from "vitest";
import { createDeveloperWorkspace } from "./createDeveloperWorkspace";

describe("developer workspace fixtures", () => {
  it("provides draft, published, and archived CVs with reusable Block Versions", async () => {
    const { blockLibrary, cvWorkspace } = createDeveloperWorkspace();
    const catalog = await blockLibrary.browse({ includeArchived: true });
    const cvs = await cvWorkspace.list();

    expect(catalog.blocks).toHaveLength(9);
    expect(catalog.blocks.find((block) => block.id === "dev-block-google-launch")?.versions).toHaveLength(2);
    expect(catalog.sidebar.skills).toHaveLength(2);
    expect(cvs.map((cv) => cv.status)).toEqual(expect.arrayContaining(["draft", "published", "archived"]));
    await expect(cvWorkspace.revision(
      "dev-cv-product-google",
      "dev-cv-product-google-revision-1",
    )).resolves.toMatchObject({
      selections: expect.arrayContaining([
        expect.objectContaining({
          blockId: "dev-block-google-launch",
          versionId: "dev-version-google-launch-2",
        }),
      ]),
    });
  });

  it("starts editable working compositions and applies reviewed Block edits in memory", async () => {
    const { blockLibrary, cvWorkspace } = createDeveloperWorkspace();
    const sessions = await cvWorkspace.editingSessions("dev-cv-product-google");
    const block = await blockLibrary.getBlock("dev-block-google-launch");

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ status: "open", baseRevisionNumber: 1 });

    const proposal = await cvWorkspace.proposeContentChanges({
      schemaVersion: "1",
      target: { type: "editing_session", id: sessions[0].id },
      baseVersion: sessions[0].optimisticVersion,
      operations: [{
        type: "append_block_version",
        blockId: block.id,
        basedOnVersionId: block.currentVersion.id,
        content: { text: "Developer access edit", highlights: ["Safe fixture"] },
      }],
    });
    const applied = await cvWorkspace.applyChangeProposal(proposal.id);
    const updatedBlock = await blockLibrary.getBlock(block.id);
    const appended = updatedBlock.currentVersion;

    expect(appended).toMatchObject({ blockId: block.id, number: 3 });
    expect(appended).toMatchObject({ content: { text: "Developer access edit" } });
    expect(applied.result.affectedIdentities.versionIds).toContain(appended.id);
    await expect(cvWorkspace.resumeEditingSession(sessions[0].id)).resolves.toMatchObject({
      optimisticVersion: 2,
      selections: expect.arrayContaining([
        expect.objectContaining({
          blockId: block.id,
          versionId: "dev-version-google-launch-2",
        }),
      ]),
    });
  });
});
