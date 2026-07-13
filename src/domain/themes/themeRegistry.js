export const DEFAULT_THEME_ID = "editorial";

export const THEME_REGISTRY = Object.freeze({
  editorial: Object.freeze({
    id: "editorial",
    name: "Editorial",
    description: "A classic serif-led CV with a calm sidebar.",
  }),
  modern: Object.freeze({
    id: "modern",
    name: "Modern",
    description: "A crisp sans-serif CV with stronger colour accents.",
  }),
});

export function listThemes() {
  return Object.values(THEME_REGISTRY);
}

export function resolveTheme(themeId) {
  return THEME_REGISTRY[themeId] || THEME_REGISTRY[DEFAULT_THEME_ID];
}

