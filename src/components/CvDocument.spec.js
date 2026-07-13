// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import CvDocument from "./CvDocument.vue";

const experiences = Array.from({ length: 30 }, (_, index) => ({
  blockId: `block-${index}`,
  versionId: `version-${index}`,
  section: "experience",
  order: index,
  block: { title: `Company ${index}` },
  content: { text: `Delivered measurable outcome ${index}.` },
}));

describe.each(["editorial", "modern"])("%s print renderer", (themeId) => {
  it("renders representative multipage content and useful contact links", () => {
    const wrapper = mount(CvDocument, {
      props: {
        document: {
          name: "Product CV",
          themeId,
          profile: { basics: { name: "Nic Benson", email: "nic@example.com", phone: "+61400000000", url: "https://example.com" } },
          selections: experiences,
        },
      },
    });
    expect(wrapper.get(".cv-document").attributes("data-theme")).toBe(themeId);
    expect(wrapper.findAll(".cv-entry")).toHaveLength(30);
    expect(wrapper.get('a[href="mailto:nic@example.com"]').exists()).toBe(true);
    expect(wrapper.get('a[href="tel:+61400000000"]').exists()).toBe(true);
  });
});

it("renders an unknown theme through the editorial fallback without changing content", () => {
  const wrapper = mount(CvDocument, { props: { document: { name: "Fallback", themeId: "retired", profile: {}, selections: experiences.slice(0, 1) } } });
  expect(wrapper.get(".cv-document").attributes("data-theme")).toBe("editorial");
  expect(wrapper.text()).toContain("Delivered measurable outcome 0.");
});
