import {
  BLOCK_SCHEMA_REGISTRY,
  BLOCK_SCHEMA_VERSION,
} from "../blocks/blockSchemaRegistry";
import {
  JSON_RESUME_ADAPTER,
  JSON_RESUME_ADAPTER_VERSION,
  JSON_RESUME_SCHEMA_URL,
} from "../cvs/compositionAdapterRegistry";
import {
  CHANGE_PROPOSAL_OPERATION_TYPES,
  CHANGE_PROPOSAL_STATUSES,
  nextChangeProposalActions,
} from "../cvs/changeProposal";

export const MCP_READ_SCHEMA_VERSION = "1";

export function compositionSchema() {
  return {
    schemaVersion: "1",
    description: "An ordered selection of exact immutable Block Versions.",
    exactBlockVersions: true,
    maxVersionsPerBlockIdentity: 1,
    sections: ["experience", "skills", "certifications", "education", "interests"],
    immutableInCvRevision: true,
    mutableInEditingSessionOnlyThroughChangeProposal: true,
    selection: {
      required: ["blockId", "versionId", "section", "order"],
      order: "zero-based within section",
    },
  };
}

export function adapterCapabilities() {
  return [{
    name: JSON_RESUME_ADAPTER,
    versions: [JSON_RESUME_ADAPTER_VERSION],
    schemaUrl: JSON_RESUME_SCHEMA_URL,
    mappings: {
      employmentOccasion: "work",
      experienceBlock: "work[].highlights[]",
      skill: "skills",
      certification: "certificates",
      education: "education",
      interest: "interests",
    },
    acceptedDatePrecision: ["YYYY", "YYYY-MM", "YYYY-MM-DD"],
    ongoingEmploymentOmitsEndDate: true,
  }];
}

export function changeProposalSchema() {
  return {
    schemaVersion: "1",
    explicitApplyRequired: true,
    statuses: [...CHANGE_PROPOSAL_STATUSES],
    operations: [...CHANGE_PROPOSAL_OPERATION_TYPES],
    required: [
      "id",
      "schemaVersion",
      "operationType",
      "target",
      "operations",
      "diff",
      "warnings",
      "status",
      "expiresAt",
      "nextActions",
    ],
    pendingNextActions: nextChangeProposalActions("pending"),
    rules: [
      "Creating a Change Proposal does not mutate its target.",
      "Apply is a separate explicit operation and revalidates ownership and stale state.",
      "Discard and expiry do not mutate the target.",
    ],
  };
}

export function supportedSchemas() {
  return {
    blockContent: {
      currentVersion: BLOCK_SCHEMA_VERSION,
      versions: BLOCK_SCHEMA_REGISTRY,
    },
    composition: compositionSchema(),
    adapters: adapterCapabilities(),
    changeProposal: changeProposalSchema(),
  };
}

export function readEnvelope(data) {
  return { schemaVersion: MCP_READ_SCHEMA_VERSION, data };
}
