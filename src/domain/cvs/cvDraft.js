export const CV_SECTIONS = [
  "experience",
  "skills",
  "certifications",
  "education",
  "interests",
];

export class CvDraftError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CvDraftError";
    this.code = code;
  }
}

export function normalizeSlug(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeDraft(input = {}) {
  return {
    id: input.id || null,
    name: String(input.name || "Untitled CV").trim(),
    slug: input.slug || null,
    status: input.status === "published" ? "published" : "draft",
    themeId: input.themeId || null,
    profile: input.profile || {},
    summary: input.summary || "",
    summaryProvenance: input.summaryProvenance || null,
    publishedAt: input.publishedAt || null,
    selections: normalizeSelections(input.selections || []),
  };
}

export function normalizeSelections(selections) {
  return selections
    .map((selection) => ({
      blockId: selection.blockId,
      versionId: selection.versionId,
      section: selection.section,
      order: Number(selection.order || 0),
      ...(selection.content ? { content: selection.content } : {}),
      ...(selection.block ? { block: selection.block } : {}),
    }))
    .sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order)
    .map((selection, index, all) => ({
      ...selection,
      order: all.slice(0, index).filter((x) => x.section === selection.section)
        .length,
    }));
}

function assertSection(section) {
  if (!CV_SECTIONS.includes(section)) {
    throw new CvDraftError("invalid-section", `Unsupported CV section: ${section}`);
  }
}

export function addSelection(draft, input) {
  assertSection(input.section);
  if (!input.blockId || !input.versionId) {
    throw new CvDraftError(
      "invalid-selection",
      "A selection requires a block and an exact version.",
    );
  }
  if (draft.selections.some((item) => item.versionId === input.versionId)) {
    return normalizeDraft(draft);
  }
  return normalizeDraft({
    ...draft,
    selections: [
      ...draft.selections,
      {
        blockId: input.blockId,
        versionId: input.versionId,
        section: input.section,
        order: draft.selections.filter((item) => item.section === input.section)
          .length,
      },
    ],
  });
}

export function removeSelection(draft, versionId) {
  return normalizeDraft({
    ...draft,
    selections: draft.selections.filter((item) => item.versionId !== versionId),
  });
}

export function moveSelection(draft, versionId, section, order = 0) {
  assertSection(section);
  const selected = draft.selections.find((item) => item.versionId === versionId);
  if (!selected) throw new CvDraftError("selection-not-found", "Selection not found.");
  const remaining = draft.selections.filter((item) => item.versionId !== versionId);
  const target = remaining.filter((item) => item.section === section);
  const boundedOrder = Math.max(0, Math.min(Number(order), target.length));
  target.splice(boundedOrder, 0, { ...selected, section });
  return normalizeDraft({
    ...draft,
    selections: [
      ...remaining.filter((item) => item.section !== section),
      ...target.map((item, index) => ({ ...item, order: index })),
    ],
  });
}

