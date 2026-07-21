import { describe, expect, it } from "vitest";
import {
  adapterCapabilities,
  changeProposalSchema,
  compositionSchema,
  readEnvelope,
} from "./readContracts";

describe("MCP read contracts", () => {
  it("returns one consistent versioned structured envelope", () => {
    expect(readEnvelope([{ id: "cv-1" }])).toEqual({
      schemaVersion: "1",
      data: [{ id: "cv-1" }],
    });
  });

  it("describes composition, adapter, and proposal boundaries", () => {
    expect(compositionSchema()).toMatchObject({
      schemaVersion: "1",
      exactBlockVersions: true,
      maxVersionsPerBlockIdentity: 1,
    });
    expect(adapterCapabilities()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "json-resume", versions: ["1"] }),
    ]));
    expect(changeProposalSchema()).toMatchObject({
      schemaVersion: "1",
      explicitApplyRequired: true,
      operations: expect.arrayContaining(["edit_content", "replace_working_state"]),
      contentOperations: ["append_block_version", "replace_working_state"],
      statuses: ["pending", "applied", "discarded", "expired", "invalidated"],
    });
  });
});
