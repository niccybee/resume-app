import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_ID,
  listThemes,
  resolveTheme,
} from "./themeRegistry";

describe("theme registry", () => {
  it("offers every supported theme to CV builders", () => {
    expect(listThemes().map((theme) => theme.id)).toEqual([
      "editorial",
      "modern",
      "jsonresume-even",
      "jsonresume-actual",
      "jsonresume-class",
      "magazine-folio",
      "magazine-basel",
      "magazine-gallery",
      "magazine-dispatch",
      "magazine-atelier",
    ]);

    for (const theme of listThemes().filter((item) => item.source)) {
      expect(theme.license).toBe("MIT");
      expect(theme.source).toMatch(/^https:\/\/github\.com\//);
    }
  });

  it("resolves every supported theme", () => {
    for (const theme of listThemes()) expect(resolveTheme(theme.id)).toBe(theme);
  });

  it.each([undefined, null, "", "retired-theme"])(
    "falls back for unsupported theme %s",
    (themeId) => {
      expect(resolveTheme(themeId).id).toBe(DEFAULT_THEME_ID);
    },
  );
});
