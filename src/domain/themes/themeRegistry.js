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
  "jsonresume-even": Object.freeze({
    id: "jsonresume-even",
    name: "Even",
    description: "A flat, airy layout with a subtle experience timeline.",
    source: "https://github.com/rbardini/jsonresume-theme-even",
    license: "MIT",
  }),
  "jsonresume-actual": Object.freeze({
    id: "jsonresume-actual",
    name: "Actual",
    description: "A restrained monochrome CV with bold, minimal typography.",
    source: "https://github.com/davcd/jsonresume-theme-actual",
    license: "MIT",
  }),
  "jsonresume-class": Object.freeze({
    id: "jsonresume-class",
    name: "Class",
    description: "An ATS-friendly single-column CV with a confident blue header.",
    source: "https://github.com/jsonresume/jsonresume-theme-class",
    license: "MIT",
  }),
  "magazine-folio": Object.freeze({
    id: "magazine-folio",
    name: "Folio",
    description: "A literary, serif-led page inspired by classic editorial restraint.",
  }),
  "magazine-basel": Object.freeze({
    id: "magazine-basel",
    name: "Basel",
    description: "A Swiss modernist grid with bold typography and precise colour signals.",
  }),
  "magazine-gallery": Object.freeze({
    id: "magazine-gallery",
    name: "Gallery",
    description: "A curatorial art-journal layout with quiet metadata and generous space.",
  }),
  "magazine-dispatch": Object.freeze({
    id: "magazine-dispatch",
    name: "Dispatch",
    description: "A lively news-weekly system with condensed headlines and data-led labels.",
  }),
  "magazine-atelier": Object.freeze({
    id: "magazine-atelier",
    name: "Atelier",
    description: "An architectural review layout with a rational grid and warm material palette.",
  }),
});

export function listThemes() {
  return Object.values(THEME_REGISTRY);
}

export function resolveTheme(themeId) {
  return THEME_REGISTRY[themeId] || THEME_REGISTRY[DEFAULT_THEME_ID];
}
