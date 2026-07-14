import { BlockLibraryError } from "./blockLibrary";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createMemoryBlockRepository() {
  const blocks = [];
  const versions = [];
  let blockSequence = 0;
  let versionSequence = 0;
  let generationSequence = 0;

  function blockView(block) {
    return {
      ...clone(block),
      currentVersion: clone(
        versions.find((version) => version.id === block.currentVersionId),
      ),
      versions: clone(
        versions.filter((version) => version.blockId === block.id),
      ),
    };
  }

  return {
    async browse(query = {}) {
      const search = query.search?.trim().toLowerCase();

      return blocks
        .filter((block) => block.status === "active")
        .filter((block) => !query.kind || block.kind === query.kind)
        .map(blockView)
        .filter((block) => {
          if (!query.companyId && !query.roleId && !query.occasionId) return true;
          return block.contexts.some(
            (context) =>
              (!query.companyId || context.metadata?.companyId === query.companyId) &&
              (!query.roleId || context.metadata?.roleId === query.roleId) &&
              (!query.occasionId ||
                context.metadata?.occasionId === query.occasionId),
          );
        })
        .filter((block) => {
          if (!query.section) return true;
          return block.contexts.some(
            (context) =>
              context.type === "sidebar" && context.key === query.section,
          );
        })
        .filter((block) => {
          if (!search) return true;
          return JSON.stringify({
            title: block.title,
            content: block.currentVersion.content,
            contexts: block.contexts,
          })
            .toLowerCase()
            .includes(search);
        });
    },

    async saveVersion(input) {
      let block = blocks.find((candidate) => candidate.id === input.blockId);

      if (!block) {
        if (input.blockId) {
          throw new BlockLibraryError("block-not-found", "Block not found.");
        }
        block = {
          id: `block-${++blockSequence}`,
          kind: input.kind,
          title: input.title,
          status: "active",
          contexts: clone(input.contexts || []),
          currentVersionId: null,
        };
        blocks.push(block);
      } else {
        if (block.currentVersionId !== input.basedOnVersionId) {
          throw new BlockLibraryError(
            "conflict",
            "This block has changed since the selected base version.",
          );
        }
        if (input.contexts) block.contexts = clone(input.contexts);
      }

      const version = {
        id: `version-${++versionSequence}`,
        blockId: block.id,
        number:
          versions.filter((candidate) => candidate.blockId === block.id).length + 1,
        content: clone(input.content),
        source: clone(input.source),
        basedOnVersionId: input.basedOnVersionId || null,
        createdAt: new Date(versionSequence * 1000).toISOString(),
      };
      versions.push(version);
      block.currentVersionId = version.id;

      return clone(version);
    },

    async resolve(versionIds) {
      return versionIds.map((versionId) => {
        const version = versions.find((candidate) => candidate.id === versionId);
        if (!version) {
          throw new BlockLibraryError(
            "version-not-found",
            `Block version not found: ${versionId}`,
          );
        }
        return clone(version);
      });
    },

    async recordSuggestion(input) {
      return {
        id: `generation-${++generationSequence}`,
        ...clone(input),
      };
    },
  };
}
