import { describe, expect, it } from "vitest";
import { createBlockLibrary } from "./blockLibrary";
import { createMemoryBlockRepository } from "./createMemoryBlockRepository";
import { importLegacyCvItems } from "./importLegacyCvItems";
import { validateBlockContent } from "./blockSchemaRegistry";

function createTestLibrary(generator) {
  return createBlockLibrary({
    repository: createMemoryBlockRepository(),
    generator,
  });
}

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

describe("BlockLibrary", () => {
  it("validates every CV Block kind through the versioned schema registry", () => {
    const valid = {
      experience: { text: "Led a product launch." },
      skill: { name: "Product analytics", keywords: ["SQL"] },
      certification: { name: "GA4", issuer: "Google" },
      education: { institution: "RMIT", area: "Marketing" },
      interest: { name: "Basketball", keywords: ["NBL"] },
    };

    for (const [kind, content] of Object.entries(valid)) {
      expect(validateBlockContent({ kind, schemaVersion: "1", content })).toEqual(content);
    }
    expect(() => validateBlockContent({ kind: "skill", schemaVersion: "1", content: { name: "", keywords: "SQL" } }))
      .toThrow(expect.objectContaining({ code: "invalid-content" }));
    expect(() => validateBlockContent({ kind: "experience", schemaVersion: "1", content: { text: "Led a launch.", highlights: ["Three markets"] } }))
      .toThrow(expect.objectContaining({ code: "invalid-content" }));
    expect(() => validateBlockContent({ kind: "skill", schemaVersion: "1", content: { name: "Analytics", privateNote: "not in schema" } }))
      .toThrow(expect.objectContaining({ code: "invalid-content" }));
    expect(() => validateBlockContent({ kind: "certification", schemaVersion: "1", content: { name: "GA4", date: "2026-99" } }))
      .toThrow(expect.objectContaining({ code: "invalid-content" }));
    expect(() => validateBlockContent({ kind: "education", schemaVersion: "1", content: { institution: "RMIT", startDate: "2026-02-29" } }))
      .toThrow(expect.objectContaining({ code: "invalid-content" }));
    expect(validateBlockContent({ kind: "education", schemaVersion: "1", content: { institution: "RMIT", startDate: "2024-02-29", endDate: "2026-07" } }))
      .toMatchObject({ startDate: "2024-02-29", endDate: "2026-07" });
    expect(() => validateBlockContent({ kind: "skill", schemaVersion: "99", content: valid.skill }))
      .toThrow(expect.objectContaining({ code: "unsupported-schema-version" }));
  });

  it("categorises experience by stable employer and role identities", async () => {
    const blocks = createTestLibrary();

    await blocks.saveVersion({
      kind: "experience",
      title: "CRM migration leadership",
      context: employmentContext,
      content: { text: "Led a cross-functional CRM migration." },
    });
    await blocks.saveVersion({
      kind: "experience",
      title: "Unassigned achievement",
      content: { text: "Improved a customer workflow." },
    });

    const catalog = await blocks.browse();

    expect(catalog.experience).toEqual([
      expect.objectContaining({
        employerId: "e2",
        employer: "E2",
        occasions: [
          expect.objectContaining({
            roleId: "digital-marketing-manager",
            role: "Digital Marketing Manager",
          }),
        ],
      }),
      expect.objectContaining({
        employerId: "unassigned-employer",
        employer: "Unassigned employer",
        occasions: [
          expect.objectContaining({
            roleId: "unassigned-role",
            role: "Unassigned role",
          }),
        ],
      }),
    ]);
  });

  it("keeps and filters separate occasions with the same employer and role", async () => {
    const blocks = createTestLibrary();
    const occasion = (startDate, endDate) => ({
      ...employmentContext,
      key: `e2-digital-marketing-manager-${startDate}`,
      metadata: {
        ...employmentContext.metadata,
        occasionId: `e2-digital-marketing-manager-${startDate}`,
        startDate,
        endDate,
      },
    });

    await blocks.saveVersion({
      kind: "experience",
      title: "Earlier lifecycle work",
      context: occasion("2021-03", "2022-06"),
      content: { text: "Led lifecycle reporting." },
    });
    await blocks.saveVersion({
      kind: "experience",
      title: "Current acquisition work",
      context: occasion("2024-02", "present"),
      content: { text: "Rebuilt acquisition planning." },
    });

    const catalog = await blocks.browse();
    const filtered = await blocks.browse({
      occasionId: "e2-digital-marketing-manager-2024-02",
    });

    expect(catalog.experience[0].occasions).toHaveLength(2);
    expect(catalog.experience[0].occasions.map((item) => item.startDate)).toEqual([
      "2021-03",
      "2024-02",
    ]);
    expect(filtered.blocks).toHaveLength(1);
    expect(filtered.blocks[0].title).toBe("Current acquisition work");
  });

  it("appends immutable versions and rejects stale edits", async () => {
    const blocks = createTestLibrary();
    const first = await blocks.saveVersion({
      kind: "experience",
      title: "Reporting automation",
      context: employmentContext,
      content: { text: "Automated reporting." },
    });
    const second = await blocks.saveVersion({
      blockId: first.blockId,
      basedOnVersionId: first.id,
      content: { text: "Automated multi-channel reporting." },
    });

    await expect(
      blocks.saveVersion({
        blockId: first.blockId,
        basedOnVersionId: first.id,
        content: { text: "A stale edit." },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(blocks.resolve([first.id, second.id])).resolves.toEqual([
      expect.objectContaining({ schemaVersion: "1", content: { text: "Automated reporting." } }),
      expect.objectContaining({
        schemaVersion: "1",
        basedOnVersionId: first.id,
        content: { text: "Automated multi-channel reporting." },
      }),
    ]);
  });

  it("duplicates a CV Block into an independent identity and version history", async () => {
    const blocks = createTestLibrary();
    const source = await blocks.saveVersion({
      kind: "experience", title: "Launch", context: employmentContext,
      content: { text: "Launched the product." },
    });

    const duplicate = await blocks.duplicateBlock(source.blockId, { title: "Launch for second role" });
    const catalog = await blocks.browse();
    const sourceBlock = catalog.blocks.find((block) => block.id === source.blockId);
    const duplicateBlock = catalog.blocks.find((block) => block.id === duplicate.blockId);

    expect(duplicate.blockId).not.toBe(source.blockId);
    expect(duplicate).toMatchObject({ number: 1, basedOnVersionId: null, content: source.content });
    expect(duplicateBlock).toMatchObject({ title: "Launch for second role", versions: [expect.objectContaining({ number: 1 })] });
    expect(sourceBlock.versions).toHaveLength(1);
  });

  it("rejects cross-identity base provenance when creating a CV Block", async () => {
    const blocks = createTestLibrary();
    const source = await blocks.saveVersion({
      kind: "skill", title: "Analytics", content: { name: "Analytics" },
    });

    await expect(blocks.saveVersion({
      kind: "skill", title: "Other identity", basedOnVersionId: source.id,
      content: { name: "Other" },
    })).rejects.toMatchObject({ code: "invalid-base-version" });
  });

  it("archives referenced CV Blocks instead of deleting them and deletes only unreferenced identities", async () => {
    const references = new Set();
    const repository = createMemoryBlockRepository({ isBlockReferenced: (blockId) => references.has(blockId) });
    const blocks = createBlockLibrary({ repository });
    const referenced = await blocks.saveVersion({
      kind: "skill", title: "Analytics", content: { name: "Analytics" },
    });
    const disposable = await blocks.saveVersion({
      kind: "interest", title: "Music", content: { name: "Music" },
    });
    references.add(referenced.blockId);

    await expect(blocks.deleteBlock(referenced.blockId)).rejects.toMatchObject({
      code: "block-referenced", context: { nextActions: ["archive"] },
    });
    await expect(blocks.archiveBlock(referenced.blockId)).resolves.toMatchObject({ status: "archived" });
    await expect(blocks.browse()).resolves.toMatchObject({ blocks: [expect.not.objectContaining({ id: referenced.blockId })] });
    await expect(blocks.browse({ includeArchived: true })).resolves.toMatchObject({
      blocks: expect.arrayContaining([expect.objectContaining({ id: referenced.blockId, status: "archived" })]),
    });
    await expect(blocks.restoreBlock(referenced.blockId)).resolves.toMatchObject({ status: "active" });
    references.delete(referenced.blockId);
    await expect(blocks.deleteBlock(referenced.blockId)).resolves.toMatchObject({ deletedBlockId: referenced.blockId });
    await expect(blocks.deleteBlock(disposable.blockId)).resolves.toMatchObject({ deletedBlockId: disposable.blockId });
    await expect(blocks.resolve([referenced.id])).rejects.toMatchObject({ code: "version-not-found" });
    await expect(blocks.resolve([disposable.id])).rejects.toMatchObject({ code: "version-not-found" });
  });

  it("keeps AI suggestions unsaved until explicitly accepted", async () => {
    const blocks = createTestLibrary({
      name: "test-generator",
      async suggest() {
        return { content: { text: "Led reporting automation at scale." } };
      },
    });
    const first = await blocks.saveVersion({
      kind: "experience",
      title: "Reporting automation",
      context: employmentContext,
      content: { text: "Automated reporting." },
    });

    const draft = await blocks.suggestVersion({
      blockId: first.blockId,
      basedOnVersionId: first.id,
      instruction: "Emphasise leadership",
    });
    const beforeAcceptance = await blocks.browse();
    const accepted = await blocks.saveVersion({
      blockId: first.blockId,
      basedOnVersionId: first.id,
      content: draft.content,
      source: draft.source,
    });

    expect(beforeAcceptance.blocks[0].versions).toHaveLength(1);
    expect(accepted.source).toMatchObject({
      type: "ai",
      generator: "test-generator",
      runId: "generation-1",
    });
  });

  it("resolves exact versions in the requested order", async () => {
    const blocks = createTestLibrary();
    const skill = await blocks.saveVersion({
      kind: "skill",
      title: "CRM platforms",
      context: { type: "sidebar", key: "skills", label: "Skills" },
      content: { name: "CRM", keywords: ["Salesforce", "HubSpot"] },
    });
    const interest = await blocks.saveVersion({
      kind: "interest",
      title: "Sports",
      context: { type: "sidebar", key: "interests", label: "Interests" },
      content: { name: "Sports", keywords: ["AFL", "Basketball"] },
    });

    const resolved = await blocks.resolve([interest.id, skill.id]);

    expect(resolved.map((version) => version.id)).toEqual([
      interest.id,
      skill.id,
    ]);
  });

  it("imports valid legacy CV items as initial experience versions", async () => {
    const blocks = createTestLibrary();

    const imported = await importLegacyCvItems({
      blockLibrary: blocks,
      items: [
        {
          id: 42,
          employer: "E2",
          role: "Digital Marketing Manager",
          item: "Led a CRM migration.",
        },
        { id: 43, employer: "", role: "Incomplete", item: "Skipped" },
      ],
    });
    const catalog = await blocks.browse();

    expect(imported).toHaveLength(1);
    expect(catalog.experience[0].occasions[0].blocks[0].currentVersion).toMatchObject({
      content: { text: "Led a CRM migration." },
      source: { type: "import", legacyId: 42 },
    });
  });

  it("composes search, kind, company, role, and sidebar filters", async () => {
    const blocks = createTestLibrary();
    await blocks.saveVersion({ kind: "experience", title: "CRM migration", context: employmentContext, content: { text: "Led a Salesforce migration." } });
    await blocks.saveVersion({ kind: "skill", title: "Analytics", context: { type: "sidebar", key: "skills", label: "Skills" }, content: { name: "Product analytics" } });

    await expect(blocks.browse({ search: "salesforce", kind: "experience", companyId: "e2", roleId: "digital-marketing-manager" })).resolves.toMatchObject({ blocks: [{ kind: "experience" }] });
    await expect(blocks.browse({ section: "skills" })).resolves.toMatchObject({ blocks: [{ kind: "skill" }] });
  });
});
