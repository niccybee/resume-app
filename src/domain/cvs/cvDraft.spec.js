import { describe, expect, it } from "vitest";
import {
  groupExperienceOccasions,
  moveExperienceOccasion,
  sortExperienceByJobDate,
} from "./cvDraft";

function experience(id, employer, startDate, endDate, order, text = id) {
  return {
    blockId: `block-${id}`,
    versionId: `version-${id}`,
    section: "experience",
    order,
    content: { text },
    group: {
      employerId: employer.toLowerCase(),
      employer,
      roleId: id,
      role: id,
      occasionId: `occasion-${id}`,
      startDate,
      ...(endDate ? { endDate } : {}),
    },
  };
}

describe("CV draft Experience ordering", () => {
  it("groups Employment Occasions globally without forcing one employer together", () => {
    const selections = [
      experience("e2-current", "E2", "2024-01", "", 0),
      experience("other", "Other", "2022", "2023", 1),
      experience("e2-old", "E2", "2019", "2020", 2),
    ];

    expect(groupExperienceOccasions(selections).map((item) => item.occasionId)).toEqual([
      "occasion-e2-current",
      "occasion-other",
      "occasion-e2-old",
    ]);
  });

  it("sorts whole Employment Occasions newest first while preserving Block order", () => {
    const current = experience("current", "E2", "2024-02", "", 2);
    const olderA = experience("older", "Other", "2020", "2021", 0, "First");
    const olderB = {
      ...experience("older-extra", "Other", "2020", "2021", 1, "Second"),
      group: { ...olderA.group },
    };
    const draft = { selections: [olderA, olderB, current], profile: {} };

    const sorted = sortExperienceByJobDate(draft, "newest");

    expect(sorted.selections.map((item) => item.content.text)).toEqual([
      "current",
      "First",
      "Second",
    ]);
  });

  it("sorts oldest first with ongoing Employment Occasions last", () => {
    const draft = {
      selections: [
        experience("current", "E2", "2024-02", "", 0),
        experience("oldest", "Other", "2018", "2019", 1),
        experience("middle", "Another", "2020-06", "2022", 2),
      ],
      profile: {},
    };

    const sorted = sortExperienceByJobDate(draft, "oldest");

    expect(sorted.selections.map((item) => item.group.occasionId)).toEqual([
      "occasion-oldest",
      "occasion-middle",
      "occasion-current",
    ]);
  });

  it("moves an Employment Occasion as one group", () => {
    const first = experience("first", "E2", "2024", "", 0, "First A");
    const firstB = {
      ...experience("first-b", "E2", "2024", "", 1, "First B"),
      group: { ...first.group },
    };
    const second = experience("second", "Other", "2022", "2023", 2, "Second");
    const draft = { selections: [first, firstB, second], profile: {} };

    const moved = moveExperienceOccasion(draft, first.group.occasionId, 1);

    expect(moved.selections.map((item) => item.content.text)).toEqual([
      "Second",
      "First A",
      "First B",
    ]);
  });
});
