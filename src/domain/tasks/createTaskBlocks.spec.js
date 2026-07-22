import { describe, expect, it, vi } from "vitest";
import { createBlockLibrary } from "../blocks/blockLibrary";
import { createMemoryBlockRepository } from "../blocks/createMemoryBlockRepository";
import { createTaskBlocks } from "./createTaskBlocks";

describe("reviewed task creation", () => {
  it("creates reusable blocks for distinct occasions and returns exact selections", async () => {
    const blockLibrary = createBlockLibrary({
      repository: createMemoryBlockRepository(),
    });
    const selections = await createTaskBlocks({
      blockLibrary,
      tasks: [
        {
          employer: "E2",
          role: "Marketing Manager",
          occasionId: "e2-marketing-manager-2021-03",
          startDate: "2021-03",
          endDate: "2022-06",
          item: "Led lifecycle reporting.",
        },
        {
          employer: "E2",
          role: "Marketing Manager",
          occasionId: "e2-marketing-manager-2024-02",
          startDate: "2024-02",
          endDate: "present",
          item: "Rebuilt acquisition planning.",
        },
      ],
    });
    const catalog = await blockLibrary.browse();

    expect(selections).toHaveLength(2);
    expect(selections.every((selection) => selection.section === "experience")).toBe(true);
    expect(catalog.experience[0].occasions).toHaveLength(2);
    expect(catalog.blocks.map((block) => block.currentVersion.content.text)).toEqual([
      "Led lifecycle reporting.",
      "Rebuilt acquisition planning.",
    ]);
  });
});

it("persists a reviewed task set through one atomic library operation", async () => {
  const saveVersions = vi.fn().mockResolvedValue([
    {
      id: "version-1",
      blockId: "block-1",
      number: 1,
      content: { text: "Led lifecycle reporting." },
    },
    {
      id: "version-2",
      blockId: "block-2",
      number: 1,
      content: { text: "Rebuilt acquisition planning." },
    },
  ]);
  const blockLibrary = { saveVersions };
  const tasks = [
    {
      employer: "E2",
      role: "Marketing Manager",
      occasionId: "e2-marketing-manager-2021-03",
      startDate: "2021-03",
      endDate: "2022-06",
      item: "Led lifecycle reporting.",
    },
    {
      employer: "E2",
      role: "Marketing Manager",
      occasionId: "e2-marketing-manager-2024-02",
      startDate: "2024-02",
      endDate: "present",
      item: "Rebuilt acquisition planning.",
    },
  ];

  const selections = await createTaskBlocks({ blockLibrary, tasks });

  expect(saveVersions).toHaveBeenCalledOnce();
  expect(saveVersions.mock.calls[0][0][1].contexts[0].metadata).not.toHaveProperty("endDate");
  expect(saveVersions).toHaveBeenCalledWith([
    expect.objectContaining({
      kind: "experience",
      content: { text: "Led lifecycle reporting." },
      contexts: [expect.objectContaining({
        metadata: expect.objectContaining({ occasionId: "e2-marketing-manager-2021-03" }),
      })],
    }),
    expect.objectContaining({
      kind: "experience",
      content: { text: "Rebuilt acquisition planning." },
      contexts: [expect.objectContaining({
        metadata: expect.objectContaining({ occasionId: "e2-marketing-manager-2024-02" }),
      })],
    }),
  ]);
  expect(selections.map((selection) => selection.versionId)).toEqual([
    "version-1",
    "version-2",
  ]);
});
