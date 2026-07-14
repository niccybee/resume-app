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

it("renders repeated employment occasions as distinct dated sections", () => {
  const wrapper = mount(CvDocument, {
    props: {
      document: {
        name: "Marketing CV",
        profile: {},
        selections: [
          {
            blockId: "block-earlier",
            versionId: "version-earlier",
            section: "experience",
            order: 0,
            group: {
              employerId: "e2",
              employer: "E2",
              roleId: "marketing-manager",
              role: "Marketing Manager",
              occasionId: "e2-marketing-manager-2021-03",
              startDate: "2021-03",
              endDate: "2022-06",
            },
            content: { text: "Led lifecycle reporting." },
          },
          {
            blockId: "block-current",
            versionId: "version-current",
            section: "experience",
            order: 1,
            group: {
              employerId: "e2",
              employer: "E2",
              roleId: "marketing-manager",
              role: "Marketing Manager",
              occasionId: "e2-marketing-manager-2024-02",
              startDate: "2024-02",
              endDate: "present",
            },
            content: { text: "Rebuilt acquisition planning." },
          },
        ],
      },
    },
  });

  expect(wrapper.findAll(".cv-employer")).toHaveLength(1);
  expect(wrapper.findAll(".cv-occasion")).toHaveLength(2);
  expect(wrapper.findAll(".cv-period").map((period) => period.text())).toEqual([
    "Mar 2021 – Jun 2022",
    "Feb 2024 – Present",
  ]);
  expect(wrapper.findAll(".cv-occasion").map((occasion) => occasion.text())).toEqual([
    expect.stringContaining("Led lifecycle reporting."),
    expect.stringContaining("Rebuilt acquisition planning."),
  ]);
});
