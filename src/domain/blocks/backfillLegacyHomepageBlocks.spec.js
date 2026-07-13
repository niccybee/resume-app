import { describe, expect, it } from "vitest";
import { createBlockLibrary } from "./blockLibrary";
import { createMemoryBlockRepository } from "./createMemoryBlockRepository";
import { backfillLegacyHomepageBlocks } from "./backfillLegacyHomepageBlocks";

describe("former homepage CV backfill", () => {
  it("creates every employment and sidebar block once", async () => {
    const blockLibrary = createBlockLibrary({ repository: createMemoryBlockRepository() });

    await expect(backfillLegacyHomepageBlocks({ blockLibrary })).resolves.toMatchObject({
      total: 39,
      created: 39,
      skipped: 0,
      byKind: { experience: 26, skill: 6, certification: 3, education: 1, interest: 3 },
    });
    await expect(backfillLegacyHomepageBlocks({ blockLibrary })).resolves.toMatchObject({
      total: 39,
      created: 0,
      skipped: 39,
    });
  });
});
