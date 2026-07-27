// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import Home from "./Home.vue";

function mountHome() {
  return mount(Home, {
    global: {
      stubs: {
        UButton: { template: "<a />" },
      },
    },
  });
}

describe("homepage CV evidence interaction", () => {
  it("keeps the most recently hovered evidence highlighted after pointer exit", async () => {
    const wrapper = mountHome();
    const rows = wrapper.findAll(".evidence-row");

    expect(rows).toHaveLength(3);
    expect(rows[1].classes()).toContain("active");

    await rows[0].trigger("mouseenter");
    await rows[0].trigger("mouseleave");

    expect(rows[0].classes()).toContain("active");
    expect(rows[1].classes()).not.toContain("active");
    expect(rows[0].attributes("aria-pressed")).toBe("true");
  });

  it("keeps the most recently keyboard-focused evidence highlighted after blur", async () => {
    const wrapper = mountHome();
    const rows = wrapper.findAll(".evidence-row");

    await rows[2].trigger("focus");
    await rows[2].trigger("blur");

    expect(rows[2].classes()).toContain("active");
    expect(rows[1].classes()).not.toContain("active");
    expect(rows[2].attributes("aria-pressed")).toBe("true");
  });
});
