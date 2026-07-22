import { normalizeEmploymentGroup } from "../employment/occasion";
import { BLOCK_SCHEMA_VERSION, validateBlockContent } from "./blockSchemaRegistry";

export const BLOCK_KINDS = [
  "experience",
  "skill",
  "certification",
  "education",
  "interest",
];

export class BlockLibraryError extends Error {
  constructor(code, message, context = null) {
    super(message);
    this.name = "BlockLibraryError";
    this.code = code;
    this.context = context;
  }
}

function assertContent(content, kind, schemaVersion = BLOCK_SCHEMA_VERSION) {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new BlockLibraryError(
      "invalid-content",
      "Block content must be a structured object.",
    );
  }

  if (kind) validateBlockContent({ content, kind, schemaVersion });
}

function assertKind(kind) {
  if (!BLOCK_KINDS.includes(kind)) {
    throw new BlockLibraryError("invalid-kind", `Unsupported block kind: ${kind}`);
  }
}

function createEmptySidebar() {
  return {
    skills: [],
    certifications: [],
    education: [],
    interests: [],
  };
}

function sidebarKey(kind) {
  return {
    skill: "skills",
    certification: "certifications",
    education: "education",
    interest: "interests",
  }[kind];
}

function buildCatalog(blocks) {
  const employers = new Map();
  const sidebar = createEmptySidebar();

  for (const block of blocks) {
    if (block.kind === "experience") {
      const context = block.contexts.find(
        (candidate) => candidate.type === "employment",
      );
      const occasion = normalizeEmploymentGroup(context?.metadata);

      if (!employers.has(occasion.employerId)) {
        employers.set(occasion.employerId, {
          employerId: occasion.employerId,
          employer: occasion.employer,
          occasions: new Map(),
        });
      }
      const employerGroup = employers.get(occasion.employerId);
      if (!employerGroup.occasions.has(occasion.occasionId)) {
        employerGroup.occasions.set(occasion.occasionId, {
          ...occasion,
          blocks: [],
        });
      }
      employerGroup.occasions.get(occasion.occasionId).blocks.push(block);
      continue;
    }

    const key = sidebarKey(block.kind);
    if (key) sidebar[key].push(block);
  }

  return {
    blocks,
    experience: [...employers.values()].map((group) => ({
      employerId: group.employerId,
      employer: group.employer,
      company: group.employer,
      occasions: [...group.occasions.values()],
    })),
    sidebar,
  };
}

export function createBlockLibrary({ repository, generator } = {}) {
  if (!repository) {
    throw new BlockLibraryError(
      "missing-repository",
      "BlockLibrary requires a repository adapter.",
    );
  }
  const knownKindsByBlockId = new Map();

  function normalizeVersionInput(input) {
    if (!input?.blockId) {
      assertKind(input?.kind);
      if (input?.basedOnVersionId) {
        throw new BlockLibraryError(
          "invalid-base-version",
          "A new CV Block identity cannot be based on another Block's Version.",
        );
      }
      if (!input?.title?.trim()) {
        throw new BlockLibraryError("invalid-title", "A new block requires a title.");
      }
    }
    const kind = input?.kind || knownKindsByBlockId.get(input?.blockId);
    assertKind(kind);
    assertContent(input?.content, kind, input?.schemaVersion);
    return {
      ...input,
      kind,
      schemaVersion: input.schemaVersion || BLOCK_SCHEMA_VERSION,
      title: input.title?.trim(),
      source: input.source || { type: "human" },
      contexts: input.contexts || (input.context ? [input.context] : undefined),
    };
  }

  return {
    async browse(query = {}) {
      const blocks = await repository.browse(query);
      for (const block of blocks) knownKindsByBlockId.set(block.id, block.kind);
      return buildCatalog(blocks);
    },

    async getBlock(blockId, options = {}) {
      if (!blockId) throw new BlockLibraryError("block-not-found", "CV Block not found.");
      const blocks = await repository.browse({ blockId, includeArchived: true, ...options });
      const block = blocks.find((candidate) => candidate.id === blockId);
      if (!block) throw new BlockLibraryError("block-not-found", "CV Block not found.");
      knownKindsByBlockId.set(block.id, block.kind);
      return block;
    },

    async getVersion(versionId) {
      if (!versionId) throw new BlockLibraryError("version-not-found", "Block Version not found.");
      const [version] = await repository.resolve([versionId]);
      return version;
    },

    async saveVersion(input) {
      const normalized = normalizeVersionInput(input);
      const saved = await repository.saveVersion(normalized);
      knownKindsByBlockId.set(saved.blockId, normalized.kind);
      return saved;
    },

    async saveVersions(inputs) {
      if (!Array.isArray(inputs) || inputs.length === 0) {
        throw new BlockLibraryError("invalid-version-list", "At least one block version is required.");
      }
      const normalized = inputs.map(normalizeVersionInput);
      if (repository.saveVersions) {
        const saved = await repository.saveVersions(normalized);
        saved.forEach((version, index) => knownKindsByBlockId.set(version.blockId, normalized[index].kind));
        return saved;
      }
      const versions = [];
      for (const input of normalized) {
        const saved = await repository.saveVersion(input);
        knownKindsByBlockId.set(saved.blockId, input.kind);
        versions.push(saved);
      }
      return versions;
    },

    async suggestVersion({
      blockId,
      basedOnVersionId,
      instruction,
      targetCvId,
    }) {
      if (!generator?.suggest) {
        throw new BlockLibraryError(
          "generator-unavailable",
          "No AI block generator has been configured.",
        );
      }
      if (!instruction?.trim()) {
        throw new BlockLibraryError(
          "invalid-instruction",
          "An AI instruction is required.",
        );
      }

      const [baseVersion] = await repository.resolve([basedOnVersionId]);
      if (!baseVersion || baseVersion.blockId !== blockId) {
        throw new BlockLibraryError(
          "version-not-found",
          "The requested base version does not belong to this block.",
        );
      }

      const suggestion = await generator.suggest({
        blockId,
        baseVersion,
        instruction: instruction.trim(),
        targetCvId,
      });
      assertContent(suggestion.content, baseVersion.kind || knownKindsByBlockId.get(blockId));
      const run = repository.recordSuggestion
        ? await repository.recordSuggestion({
            blockId,
            basedOnVersionId,
            instruction: instruction.trim(),
            targetCvId,
            generator: suggestion.generator || generator.name || "unknown",
            content: suggestion.content,
          })
        : null;

      return {
        ...suggestion,
        id: run?.id || suggestion.id,
        blockId,
        basedOnVersionId,
        content: suggestion.content,
        source: {
          type: "ai",
          generator: suggestion.generator || generator.name || "unknown",
          runId: run?.id,
          instruction: instruction.trim(),
          basedOnVersionId,
          targetCvId,
        },
      };
    },

    async resolve(versionIds) {
      if (!Array.isArray(versionIds)) {
        throw new BlockLibraryError(
          "invalid-version-list",
          "Version IDs must be provided as an array.",
        );
      }
      return repository.resolve(versionIds);
    },

    async duplicateBlock(blockId, options = {}) {
      if (!blockId) throw new BlockLibraryError("block-not-found", "CV Block not found.");
      const saved = await repository.duplicateBlock(blockId, options);
      const kind = knownKindsByBlockId.get(blockId);
      if (kind) knownKindsByBlockId.set(saved.blockId, kind);
      return saved;
    },

    async archiveBlock(blockId) {
      return repository.setBlockStatus(blockId, "archived");
    },

    async restoreBlock(blockId) {
      return repository.setBlockStatus(blockId, "active");
    },

    async deleteBlock(blockId) {
      return repository.deleteBlock(blockId);
    },
  };
}
