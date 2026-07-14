import { normalizeEmploymentGroup } from "../employment/occasion";

export const BLOCK_KINDS = [
  "experience",
  "skill",
  "certification",
  "education",
  "interest",
];

export class BlockLibraryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BlockLibraryError";
    this.code = code;
  }
}

function assertContent(content, kind) {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new BlockLibraryError(
      "invalid-content",
      "Block content must be a structured object.",
    );
  }

  const requiredField = {
    experience: "text",
    skill: "name",
    certification: "name",
    education: "institution",
    interest: "name",
  }[kind];
  if (
    requiredField &&
    (typeof content[requiredField] !== "string" ||
      !content[requiredField].trim())
  ) {
    throw new BlockLibraryError(
      "invalid-content",
      `${kind} content requires a non-empty ${requiredField}.`,
    );
  }
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

  return {
    async browse(query = {}) {
      const blocks = await repository.browse(query);
      return buildCatalog(blocks);
    },

    async saveVersion(input) {
      if (!input?.blockId) {
        assertKind(input?.kind);
        if (!input?.title?.trim()) {
          throw new BlockLibraryError(
            "invalid-title",
            "A new block requires a title.",
          );
        }
      }

      assertContent(input?.content, input?.kind);
      return repository.saveVersion({
        ...input,
        title: input.title?.trim(),
        source: input.source || { type: "human" },
        contexts: input.contexts || (input.context ? [input.context] : undefined),
      });
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
      assertContent(suggestion.content, baseVersion.kind);
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
  };
}
