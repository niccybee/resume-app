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
  CONTENT_CHANGE_OPERATION_TYPES,
  nextChangeProposalActions,
} from "../cvs/changeProposal";

export const MCP_READ_SCHEMA_VERSION = "1";

export function domainGlossary() {
  return {
    CV: {
      preferred: "CV",
      definition: "A stable role-and-employer-focused lineage that groups a linear sequence of numbered CV Revisions.",
      avoid: ["Resume"],
    },
    CVRevision: {
      preferred: "CV Revision",
      definition: "A numbered immutable snapshot created when an Editing Session finishes. Its number records completion order and its base records ancestry.",
      immutable: true,
      avoid: ["CV copy", "standalone version"],
    },
    PublishedRevision: {
      preferred: "Published Revision",
      definition: "The immutable CV Revision selected for a CV's public link. Finishing an Editing Session never changes it; publication and rollback are explicit.",
      immutable: true,
      avoid: ["Live draft", "latest Revision"],
    },
    CVBlock: {
      preferred: "CV Block",
      definition: "A reusable content identity that is not owned by one CV. It may be deleted only when no CV Composition references any of its Block Versions; otherwise it may only be archived.",
      avoid: ["Resume block", "item"],
    },
    BlockVersion: {
      preferred: "Block Version",
      definition: "An immutable snapshot of a CV Block's content. Content changes append a new Block Version.",
      immutable: true,
      avoid: ["Edited block"],
    },
    ExperienceBlock: {
      preferred: "Experience Block",
      definition: "One professional achievement associated with an Employment Occasion and projected to a JSON Resume work highlight.",
      avoid: ["Job", "work entry"],
    },
    EmploymentOccasion: {
      preferred: "Employment Occasion",
      definition: "One period in which the user held a role at an employer. It groups Experience Blocks and supplies work-entry details.",
      avoid: ["Company", "role"],
    },
    CVComposition: {
      preferred: "CV Composition",
      definition: "The format-neutral ordered selection of exact Block Versions in a CV Revision, with at most one Version from each CV Block. Adapters project it into external schemas.",
      immutable: true,
      avoid: ["Resume contents"],
    },
    EditingSession: {
      preferred: "Editing Session",
      definition: "A durable mutable workspace based on a CV Revision or copied state. Change Proposals persist its Working Composition and finishing creates a CV Revision. Multiple sessions may remain open.",
      avoid: ["Chat", "temporary draft", "draft CV Revision"],
    },
    WorkingComposition: {
      preferred: "Working Composition",
      definition: "The mutable ordered selection of exact Block Versions inside an Editing Session. Finishing snapshots it as a CV Composition.",
      mutable: true,
      avoid: ["Draft CV Revision"],
    },
    ChangeProposal: {
      preferred: "Change Proposal",
      definition: "A validated, non-persistent description of an intended change. It has no effect until the user explicitly applies it.",
      avoid: ["Pending change", "draft write"],
    },
    CVCopy: {
      preferred: "CV Copy",
      definition: "A clone of a source CV Revision or Editing Session with explicit lineage intent. Copy for New Role starts Revision 1 in a new CV; Copy to New Version stays in the same CV. The source remains unchanged and open.",
      avoid: ["Branch", "fork", "generic duplicate"],
    },
    Archived: {
      preferred: "Archived",
      definition: "Retained outside the active workspace for deliberate restoration or reuse. Archiving a CV never cascades, and a CV Block is eligible only when no non-archived CV Composition references one of its Versions.",
      avoid: ["Deleted", "inactive"],
    },
  };
}

export function proposalResultContract() {
  return {
    schemaVersion: "1",
    statuses: {
      pending: { result: null, nextActions: ["apply", "discard"] },
      applied: { resultRequired: true, nextActions: ["resume", "propose", "finish"] },
      discarded: { result: null, nextActions: [] },
      expired: { result: null, nextActions: [] },
      invalidated: { resultOptional: true, nextActions: [] },
    },
    operationResults: {
      edit_content: { required: ["editingSessionId", "optimisticVersion", "affectedIdentities"] },
      replace_working_state: { required: ["editingSessionId", "optimisticVersion", "affectedIdentities"] },
      create_cv: { required: ["cvId", "editingSessionId", "optimisticVersion"] },
      start_editing_session: { required: ["cvId", "editingSessionId", "optimisticVersion"] },
      resume_editing_session: { required: ["cvId", "editingSessionId", "optimisticVersion"] },
      finish_editing_session: {
        required: ["cvId", "editingSessionId", "optimisticVersion", "revisionId", "revisionNumber", "publishedRevisionId"],
      },
      copy_to_new_version: { required: ["cvId", "editingSessionId", "optimisticVersion"] },
      copy_for_new_role: { required: ["cvId", "editingSessionId", "optimisticVersion"] },
      archive_editing_session: { required: ["cvId", "editingSessionId", "optimisticVersion"] },
      restore_editing_session: { required: ["cvId", "editingSessionId", "optimisticVersion"] },
      archive_cv: { required: ["cvId"], optional: ["status"] },
      restore_cv: { required: ["cvId"], optional: ["status"] },
      archive_cv_block: { required: ["blockId", "versionId", "status"] },
      restore_cv_block: { required: ["blockId", "versionId", "status"] },
      create_cv_block: { required: ["blockId", "versionId"] },
      duplicate_cv_block: { required: ["blockId", "versionId"] },
      delete_cv_block: { required: ["deletedBlockId"] },
      publish_revision: { required: ["cvId", "revisionId", "slug", "status"] },
      withdraw_publication: { required: ["cvId", "revisionId", "slug", "status"] },
    },
    conflictCodes: [
      "stale-proposal", "stale-block-version", "invalid-lifecycle-transition",
      "authentication-required", "not-found", "slug-conflict",
    ],
  };
}

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
    contentOperations: [...CONTENT_CHANGE_OPERATION_TYPES],
    required: [
      "id",
      "schemaVersion",
      "operationType",
      "target",
      "baseOptimisticVersion",
      "diff",
      "warnings",
      "status",
      "createdAt",
      "expiresAt",
      "nextActions",
    ],
    serverInternalFields: ["operations"],
    pendingNextActions: nextChangeProposalActions("pending"),
    resultContract: proposalResultContract(),
    rules: [
      "Creating a Change Proposal does not mutate its target.",
      "Apply is a separate explicit operation and revalidates ownership and stale state.",
      "Discard and expiry do not mutate the target.",
      "Stored normalized operations are server-internal; MCP responses expose structured diff, warnings, and result without raw operations.",
    ],
  };
}

export function supportedSchemas() {
  return {
    glossary: domainGlossary(),
    blockContent: {
      currentVersion: BLOCK_SCHEMA_VERSION,
      versions: BLOCK_SCHEMA_REGISTRY,
    },
    composition: compositionSchema(),
    adapters: adapterCapabilities(),
    changeProposal: changeProposalSchema(),
    proposalResult: proposalResultContract(),
  };
}

export function readEnvelope(data) {
  return { schemaVersion: MCP_READ_SCHEMA_VERSION, data };
}
