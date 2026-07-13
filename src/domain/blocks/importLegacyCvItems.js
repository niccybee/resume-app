function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function importLegacyCvItems({ items, blockLibrary }) {
  const imported = [];

  for (const item of items) {
    if (!item.employer?.trim() || !item.role?.trim() || !item.item?.trim()) {
      continue;
    }
    const companyId = slugify(item.employer);
    const roleId = slugify(item.role);
    imported.push(
      await blockLibrary.saveVersion({
        kind: "experience",
        title: `${item.role.trim()} at ${item.employer.trim()}`,
        content: { text: item.item.trim() },
        source: { type: "import", legacyId: item.id },
        context: {
          type: "employment",
          key: `${companyId}-${roleId}`,
          label: `${item.employer.trim()} · ${item.role.trim()}`,
          metadata: {
            companyId,
            company: item.employer.trim(),
            roleId,
            role: item.role.trim(),
          },
        },
      }),
    );
  }

  return imported;
}
