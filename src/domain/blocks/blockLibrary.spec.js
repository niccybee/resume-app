import { describe, expect, it } from "vitest";
import { createBlockLibrary } from "./blockLibrary";
import { createMemoryBlockRepository } from "./createMemoryBlockRepository";
import { importLegacyCvItems } from "./importLegacyCvItems";

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
        roles: [
          expect.objectContaining({
            roleId: "digital-marketing-manager",
            role: "Digital Marketing Manager",
          }),
        ],
      }),
      expect.objectContaining({
        employerId: "unassigned-employer",
        employer: "Unassigned employer",
        roles: [
          expect.objectContaining({
            roleId: "unassigned-role",
            role: "Unassigned role",
          }),
        ],
      }),
    ]);
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
      expect.objectContaining({ content: { text: "Automated reporting." } }),
      expect.objectContaining({
        content: { text: "Automated multi-channel reporting." },
      }),
    ]);
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
    expect(catalog.experience[0].roles[0].blocks[0].currentVersion).toMatchObject({
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
