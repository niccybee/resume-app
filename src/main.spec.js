// @vitest-environment jsdom

import { flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

it("boots the routed application with Pinia available to workspace views", async () => {
  window.history.replaceState({}, "", "/app/cvs");
  document.body.innerHTML = '<div id="app"></div>';

  await import("./main");
  await flushPromises();

  expect(document.querySelector('[data-layout="workspace"]')).not.toBeNull();
  expect(document.body.textContent).toContain("Saved CVs");
});
