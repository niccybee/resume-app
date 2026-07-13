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

it("groups experience achievements under employer and role headings", () => {
  const wrapper = mount(CvDocument, {
    props: {
      document: {
        name: "Marketing CV",
        profile: {},
        selections: [
          {
            blockId: "block-1",
            versionId: "version-1",
            section: "experience",
            order: 0,
            group: { employerId: "e2", employer: "E2", roleId: "marketing", role: "Marketing Manager" },
            content: { text: "Led the CRM migration." },
          },
          {
            blockId: "block-2",
            versionId: "version-2",
            section: "experience",
            order: 1,
            group: { employerId: "e2", employer: "E2", roleId: "marketing", role: "Marketing Manager" },
            content: { text: "Improved lifecycle conversion." },
          },
          {
            blockId: "block-3",
            versionId: "version-3",
            section: "experience",
            order: 2,
            group: { employerId: "e2", employer: "E2", roleId: "product", role: "Product Manager" },
            content: { text: "Launched the learner dashboard." },
          },
        ],
      },
    },
  });

  expect(wrapper.findAll(".cv-employer")).toHaveLength(1);
  expect(wrapper.findAll(".cv-role")).toHaveLength(2);
  expect(wrapper.get(".cv-employer > h3").text()).toBe("E2");
  expect(wrapper.findAll(".cv-achievement").map((item) => item.text())).toEqual([
    "Led the CRM migration.",
    "Improved lifecycle conversion.",
    "Launched the learner dashboard.",
  ]);
});
