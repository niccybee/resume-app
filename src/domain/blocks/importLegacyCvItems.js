import { createEmploymentContext } from "../employment/occasion";

export async function importLegacyCvItems({ items, blockLibrary }) {
  const imported = [];

  for (const item of items) {
    if (!item.employer?.trim() || !item.role?.trim() || !item.item?.trim()) {
      continue;
    }
    const context = createEmploymentContext({
      employer: item.employer,
      role: item.role,
      startDate: item.startDate,
      endDate: item.endDate,
    });
    imported.push(
      await blockLibrary.saveVersion({
        kind: "experience",
        title: `${item.role.trim()} at ${item.employer.trim()}`,
        content: { text: item.item.trim() },
        source: { type: "import", legacyId: item.id },
        context,
      }),
    );
  }

  return imported;
}
