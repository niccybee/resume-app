import { normalizeEmploymentGroup } from "../employment/occasion";

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
    status: ["published", "archived"].includes(input.status) ? input.status : "draft",
    themeId: input.themeId || null,
    profile: input.profile || {},
    summary: input.summary || "",
    summaryProvenance: input.summaryProvenance || null,
    publishedAt: input.publishedAt || null,
    publishedRevisionId: input.publishedRevisionId || input.revisionId || null,
    selections: normalizeSelections(input.selections || []),
  };
}

export function normalizeSelections(selections) {
  const normalized = selections
    .map((selection) => {
      assertExactSelection(selection);
      const group = experienceGroup(selection);
      return {
        blockId: selection.blockId,
        versionId: selection.versionId,
        section: selection.section,
        order: Number(selection.order || 0),
        ...(selection.content ? { content: selection.content } : {}),
        ...(selection.block ? { block: selection.block } : {}),
        ...(group ? { group } : {}),
      };
    });
  const seenBlockIds = new Set();
  for (const selection of normalized) {
    if (seenBlockIds.has(selection.blockId)) {
      throw new CvDraftError(
        "duplicate-block-selection",
        "A CV can include at most one Block Version from each CV Block.",
      );
    }
    seenBlockIds.add(selection.blockId);
  }
  return normalized
    .sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order)
    .map((selection, index, all) => ({
      ...selection,
      order: all.slice(0, index).filter((x) => x.section === selection.section)
        .length,
    }));
}

function experienceGroup(selection) {
  if (selection.section !== "experience") return null;
  if (selection.group) return normalizeEmploymentGroup(selection.group);
  const context = selection.block?.contexts?.find((item) => item.type === "employment");
  if (!context) return null;
  return normalizeEmploymentGroup(context.metadata);
}

export function groupExperienceSelections(selections = []) {
  const employers = new Map();
  for (const item of selections) {
    const group =
      experienceGroup({ ...item, section: "experience" }) ||
      normalizeEmploymentGroup();
    if (!employers.has(group.employerId)) {
      employers.set(group.employerId, {
        employerId: group.employerId,
        employer: group.employer,
        occasions: new Map(),
      });
    }
    const employer = employers.get(group.employerId);
    if (!employer.occasions.has(group.occasionId)) {
      employer.occasions.set(group.occasionId, { ...group, items: [] });
    }
    employer.occasions.get(group.occasionId).items.push(item);
  }
  return [...employers.values()].map((employer) => ({
    ...employer,
    occasions: [...employer.occasions.values()],
  }));
}

export function groupExperienceOccasions(selections = []) {
  const occasions = new Map();
  for (const item of selections) {
    const group =
      experienceGroup({ ...item, section: "experience" }) ||
      normalizeEmploymentGroup();
    if (!occasions.has(group.occasionId)) {
      occasions.set(group.occasionId, { ...group, items: [] });
    }
    occasions.get(group.occasionId).items.push(item);
  }
  return [...occasions.values()];
}

function dateParts(value) {
  if (!value || String(value).toLowerCase() === "present") return null;
  const [year = "0", month = "0", day = "0"] = String(value).split("-");
  return Number(year) * 10_000 + Number(month) * 100 + Number(day);
}

function compareEmploymentOccasions(left, right, direction) {
  const leftOngoing = !left.endDate || String(left.endDate).toLowerCase() === "present";
  const rightOngoing = !right.endDate || String(right.endDate).toLowerCase() === "present";
  if (leftOngoing !== rightOngoing) {
    if (direction === "newest") return leftOngoing ? -1 : 1;
    return leftOngoing ? 1 : -1;
  }

  const leftStart = dateParts(left.startDate) || 0;
  const rightStart = dateParts(right.startDate) || 0;
  const leftEnd = dateParts(left.endDate) || 0;
  const rightEnd = dateParts(right.endDate) || 0;
  if (direction === "oldest") {
    return leftStart - rightStart || leftEnd - rightEnd;
  }
  return rightEnd - leftEnd || rightStart - leftStart;
}

export function sortExperienceByJobDate(draft, direction = "newest") {
  if (!["newest", "oldest"].includes(direction)) {
    throw new CvDraftError("invalid-experience-sort", `Unsupported Experience sort: ${direction}`);
  }
  const experience = draft.selections.filter((item) => item.section === "experience");
  const indexed = groupExperienceOccasions(experience).map((occasion, index) => ({
    ...occasion,
    originalIndex: index,
  }));
  indexed.sort((left, right) => (
    compareEmploymentOccasions(left, right, direction) ||
    left.originalIndex - right.originalIndex
  ));
  const sortedExperience = indexed.flatMap((occasion) => occasion.items);
  return normalizeDraft({
    ...draft,
    selections: [
      ...draft.selections.filter((item) => item.section !== "experience"),
      ...sortedExperience.map((item, order) => ({ ...item, order })),
    ],
  });
}

export function moveExperienceOccasion(draft, occasionId, order) {
  const experience = draft.selections.filter((item) => item.section === "experience");
  const occasions = groupExperienceOccasions(experience);
  const currentIndex = occasions.findIndex((occasion) => occasion.occasionId === occasionId);
  if (currentIndex < 0) {
    throw new CvDraftError("occasion-not-found", "Employment Occasion not found.");
  }
  const [occasion] = occasions.splice(currentIndex, 1);
  const boundedOrder = Math.max(0, Math.min(Number(order), occasions.length));
  occasions.splice(boundedOrder, 0, occasion);
  return normalizeDraft({
    ...draft,
    selections: [
      ...draft.selections.filter((item) => item.section !== "experience"),
      ...occasions.flatMap((entry) => entry.items).map((item, index) => ({
        ...item,
        order: index,
      })),
    ],
  });
}

function assertSection(section) {
  if (!CV_SECTIONS.includes(section)) {
    throw new CvDraftError("invalid-section", `Unsupported CV section: ${section}`);
  }
}

function assertExactSelection(selection) {
  if (!selection.blockId || !selection.versionId) {
    throw new CvDraftError(
      "invalid-selection",
      "A selection requires a CV Block and an exact Block Version.",
    );
  }
  assertSection(selection.section);
}

export function addSelection(draft, input) {
  assertExactSelection(input);
  if (draft.selections.some((item) => item.blockId === input.blockId)) {
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
        ...(input.content ? { content: input.content } : {}),
        ...(input.block ? { block: input.block } : {}),
        ...(input.group ? { group: input.group } : {}),
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
