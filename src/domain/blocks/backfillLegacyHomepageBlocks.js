import { legacyHomepageBlockInputs } from "../../data/legacyHomepageBlocks";

export async function backfillLegacyHomepageBlocks({ blockLibrary }) {
  const inputs = legacyHomepageBlockInputs();
  const catalog = await blockLibrary.browse();
  const existingKeys = new Set(
    catalog.blocks.flatMap((block) =>
      block.versions.map((version) => version.source?.legacyKey).filter(Boolean),
    ),
  );
  const created = [];

  for (const input of inputs) {
    if (existingKeys.has(input.legacyKey)) continue;
    const version = await blockLibrary.saveVersion({
      kind: input.kind,
      title: input.title,
      content: input.content,
      contexts: input.contexts,
      source: { type: "import", legacyKey: input.legacyKey, source: "former-homepage-cv" },
    });
    created.push({ kind: input.kind, versionId: version.id });
  }

  return {
    total: inputs.length,
    created: created.length,
    skipped: inputs.length - created.length,
    byKind: created.reduce((counts, item) => ({ ...counts, [item.kind]: (counts[item.kind] || 0) + 1 }), {}),
  };
}
