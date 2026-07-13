import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_ID,
  listThemes,
  resolveTheme,
} from "./themeRegistry";

describe("theme registry", () => {
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

