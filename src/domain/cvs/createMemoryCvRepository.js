import { normalizeDraft } from "./cvDraft";
import { CvWorkspaceError } from "./createCvWorkspace";

function copy(value) {
  return structuredClone(value);
}

export function createMemoryCvRepository(initial = []) {
  const records = new Map(initial.map((item) => [item.id, normalizeDraft(item)]));
  let sequence = initial.length;

  return {
    async list() {
      return [...records.values()].map(copy);
    },
    async get(id) {
      const value = records.get(id);
      return value ? copy(value) : null;
    },
    async save(input) {
      const draft = normalizeDraft(input);
      const id = draft.id || `cv-${++sequence}`;
      const saved = { ...draft, id };
      records.set(id, saved);
      return copy(saved);
    },
    async publish(id, slug) {
      const current = records.get(id);
      if (!current) throw new CvWorkspaceError("not-found", "CV not found.");
      if ([...records.values()].some((cv) => cv.id !== id && cv.slug === slug)) {
        throw new CvWorkspaceError("slug-conflict", "That public slug is already in use.");
      }
      const saved = {
        ...current,
        slug,
        status: "published",
        publishedAt: new Date().toISOString(),
      };
      records.set(id, saved);
      return copy(saved);
    },
    async unpublish(id) {
      const current = records.get(id);
      if (!current) throw new CvWorkspaceError("not-found", "CV not found.");
      const saved = { ...current, status: "draft", publishedAt: null };
      records.set(id, saved);
      return copy(saved);
    },
    async getPublished(slug) {
      const value = [...records.values()].find(
        (cv) => cv.slug === slug && cv.status === "published",
      );
      return value ? copy(value) : null;
    },
  };
}

