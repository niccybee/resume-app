import { describe, expect, it } from "vitest";
import { createCvWorkspace } from "../cvs/createCvWorkspace";
import { createMemoryCvRepository } from "../cvs/createMemoryCvRepository";
import {
  adapterCapabilities,
  changeProposalSchema,
  compositionSchema,
  domainGlossary,
  proposalResultContract,
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
      operations: expect.arrayContaining([
        "edit_content", "replace_working_state", "create_cv_block", "duplicate_cv_block", "delete_cv_block",
      ]),
      contentOperations: ["append_block_version", "replace_working_state"],
      statuses: ["pending", "applied", "discarded", "expired", "invalidated"],
      resultContract: { schemaVersion: "1" },
      serverInternalFields: ["operations"],
    });
    expect(changeProposalSchema().required).not.toContain("operations");
    expect(domainGlossary()).toMatchObject({
      CV: expect.objectContaining({ preferred: "CV", definition: expect.stringContaining("lineage") }),
      CVRevision: expect.objectContaining({ preferred: "CV Revision", immutable: true }),
      PublishedRevision: expect.objectContaining({ preferred: "Published Revision", immutable: true }),
      CVBlock: expect.objectContaining({ preferred: "CV Block" }),
      BlockVersion: expect.objectContaining({ immutable: true }),
      ExperienceBlock: expect.objectContaining({ preferred: "Experience Block" }),
      EmploymentOccasion: expect.objectContaining({ preferred: "Employment Occasion" }),
      WorkingComposition: expect.objectContaining({ mutable: true }),
      ChangeProposal: expect.objectContaining({ preferred: "Change Proposal" }),
      CVCopy: expect.objectContaining({ preferred: "CV Copy" }),
    });
    expect(proposalResultContract()).toMatchObject({
      schemaVersion: "1",
      statuses: expect.objectContaining({
        pending: { result: null, nextActions: ["apply", "discard"] },
        applied: expect.objectContaining({ resultRequired: true }),
      }),
      operationResults: expect.objectContaining({
        edit_content: { required: expect.arrayContaining(["editingSessionId", "optimisticVersion"]) },
        finish_editing_session: {
          required: expect.arrayContaining(["optimisticVersion", "revisionId", "revisionNumber", "publishedRevisionId"]),
        },
        publish_revision: { required: expect.arrayContaining(["revisionId", "slug", "status"]) },
      }),
    });
  });

  it("describes required fields that representative applied results return", () => {
    const contract = proposalResultContract();
    const appliedResults = {
      finish_editing_session: {
        cvId: "cv-1",
        editingSessionId: "session-1",
        optimisticVersion: 3,
        revisionId: "revision-2",
        revisionNumber: 2,
        publishedRevisionId: "revision-1",
      },
      archive_cv: { cvId: "cv-1" },
      publish_revision: {
        cvId: "cv-1",
        revisionId: "revision-2",
        slug: "product-lead",
        status: "published",
      },
    };

    for (const [operation, result] of Object.entries(appliedResults)) {
      for (const field of contract.operationResults[operation].required) {
        expect(result).toHaveProperty(field);
      }
    }
  });

  it("matches the required finish result fields returned by the memory adapter", async () => {
    const workspace = createCvWorkspace({
      repository: createMemoryCvRepository([{
        id: "cv-1",
        name: "Product Lead at Example",
        status: "published",
        publishedRevisionId: "cv-1-revision-1",
        selections: [],
      }]),
    });
    const start = await workspace.proposeLifecycleChange({ operation: {
      type: "start_editing_session",
      target: { type: "cv", id: "cv-1" },
      baseRevisionId: "cv-1-revision-1",
    } });
    const started = await workspace.applyChangeProposal(start.id);
    const finish = await workspace.proposeLifecycleChange({ operation: {
      type: "finish_editing_session",
      target: { type: "editing_session", id: started.result.editingSessionId },
      baseOptimisticVersion: started.result.optimisticVersion,
    } });
    const finished = await workspace.applyChangeProposal(finish.id);

    for (const field of proposalResultContract().operationResults.finish_editing_session.required) {
      expect(finished.result).toHaveProperty(field);
    }
    expect(finished.result.publishedRevisionId).toBe("cv-1-revision-1");
  });
});
