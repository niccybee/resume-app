import { BlockLibraryError } from "./blockLibrary";
import { BLOCK_SCHEMA_VERSION, validateBlockContent } from "./blockSchemaRegistry";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createMemoryBlockRepository({ isBlockReferenced = () => false } = {}) {
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
        .filter((block) => query.includeArchived || block.status === "active")
        .filter((block) => !query.blockId || block.id === query.blockId)
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
        if (input.basedOnVersionId) {
          throw new BlockLibraryError("invalid-base-version", "A new CV Block cannot use a base Version from another identity.");
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
        if (block.status === "archived") {
          throw new BlockLibraryError("block-archived", "Restore this CV Block before appending a Block Version.");
        }
        if (block.currentVersionId !== input.basedOnVersionId) {
          throw new BlockLibraryError(
            "conflict",
            "This block has changed since the selected base version.",
          );
        }
        if (input.contexts) block.contexts = clone(input.contexts);
      }

      const schemaVersion = input.schemaVersion || BLOCK_SCHEMA_VERSION;
      validateBlockContent({ kind: block.kind, schemaVersion, content: input.content });

      const version = {
        id: `version-${++versionSequence}`,
        blockId: block.id,
        number:
          versions.filter((candidate) => candidate.blockId === block.id).length + 1,
        content: clone(input.content),
        schemaVersion,
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

    async duplicateBlock(blockId, { title } = {}) {
      const source = blocks.find((candidate) => candidate.id === blockId);
      if (!source) throw new BlockLibraryError("block-not-found", "CV Block not found.");
      const current = versions.find((version) => version.id === source.currentVersionId);
      const duplicate = {
        id: `block-${++blockSequence}`,
        kind: source.kind,
        title: title?.trim() || `${source.title} copy`,
        status: "active",
        contexts: clone(source.contexts),
        currentVersionId: null,
      };
      blocks.push(duplicate);
      const version = {
        id: `version-${++versionSequence}`,
        blockId: duplicate.id,
        number: 1,
        content: clone(current.content),
        schemaVersion: current.schemaVersion || BLOCK_SCHEMA_VERSION,
        source: { type: "human", duplicatedFromBlockId: source.id, duplicatedFromVersionId: current.id },
        basedOnVersionId: null,
        createdAt: new Date(versionSequence * 1000).toISOString(),
      };
      versions.push(version);
      duplicate.currentVersionId = version.id;
      return clone(version);
    },

    async setBlockStatus(blockId, status) {
      const block = blocks.find((candidate) => candidate.id === blockId);
      if (!block) throw new BlockLibraryError("block-not-found", "CV Block not found.");
      if (!["active", "archived"].includes(status)) throw new BlockLibraryError("invalid-status", "Unsupported CV Block status.");
      block.status = status;
      return clone(block);
    },

    async deleteBlock(blockId) {
      const blockIndex = blocks.findIndex((candidate) => candidate.id === blockId);
      if (blockIndex < 0) throw new BlockLibraryError("block-not-found", "CV Block not found.");
      if (await isBlockReferenced(blockId)) {
        throw new BlockLibraryError(
          "block-referenced",
          "CV Block is referenced. Archive it instead.",
          { nextActions: ["archive"] },
        );
      }
      blocks.splice(blockIndex, 1);
      for (let index = versions.length - 1; index >= 0; index -= 1) {
        if (versions[index].blockId === blockId) versions.splice(index, 1);
      }
      return { deletedBlockId: blockId };
    },
  };
}
