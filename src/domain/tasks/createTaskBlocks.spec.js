import { describe, expect, it } from "vitest";
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
