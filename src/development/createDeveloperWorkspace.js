import { createBlockLibrary } from "../domain/blocks/blockLibrary";
import { createMemoryBlockRepository } from "../domain/blocks/createMemoryBlockRepository";
import { createCvWorkspace } from "../domain/cvs/createCvWorkspace";
import { createMemoryCvRepository } from "../domain/cvs/createMemoryCvRepository";
import { createEmploymentContext } from "../domain/employment/occasion";

const createdAt = {
  early: "2026-04-08T02:00:00.000Z",
  middle: "2026-05-19T02:00:00.000Z",
  recent: "2026-07-18T02:00:00.000Z",
};

const contexts = {
  googleProduct: createEmploymentContext({
    employer: "Google",
    role: "Product Manager",
    startDate: "2021-03",
  }),
  atlassianProduct: createEmploymentContext({
    employer: "Atlassian",
    role: "Senior Product Manager",
    startDate: "2018-02",
    endDate: "2021-02",
  }),
};

export const DEVELOPER_BLOCK_FIXTURES = [
  {
    id: "dev-block-google-launch",
    kind: "experience",
    title: "Google — international product launch",
    status: "active",
    contexts: [contexts.googleProduct],
    currentVersionId: "dev-version-google-launch-2",
  },
  {
    id: "dev-block-google-growth",
    kind: "experience",
    title: "Google — activation and retention",
    status: "active",
    contexts: [contexts.googleProduct],
    currentVersionId: "dev-version-google-growth-1",
  },
  {
    id: "dev-block-atlassian-research",
    kind: "experience",
    title: "Atlassian — customer research programme",
    status: "active",
    contexts: [contexts.atlassianProduct],
    currentVersionId: "dev-version-atlassian-research-1",
  },
  {
    id: "dev-block-product-strategy",
    kind: "skill",
    title: "Product strategy",
    status: "active",
    contexts: [{ type: "sidebar", key: "skills", label: "Product strategy", metadata: {} }],
    currentVersionId: "dev-version-product-strategy-2",
  },
  {
    id: "dev-block-analytics",
    kind: "skill",
    title: "Product analytics",
    status: "active",
    contexts: [{ type: "sidebar", key: "skills", label: "Product analytics", metadata: {} }],
    currentVersionId: "dev-version-analytics-1",
  },
  {
    id: "dev-block-certification",
    kind: "certification",
    title: "Pragmatic Product Management",
    status: "active",
    contexts: [{ type: "sidebar", key: "certifications", label: "Product certification", metadata: {} }],
    currentVersionId: "dev-version-certification-1",
  },
  {
    id: "dev-block-education",
    kind: "education",
    title: "RMIT University",
    status: "active",
    contexts: [{ type: "sidebar", key: "education", label: "RMIT University", metadata: {} }],
    currentVersionId: "dev-version-education-1",
  },
  {
    id: "dev-block-mentoring",
    kind: "interest",
    title: "Product mentoring",
    status: "active",
    contexts: [{ type: "sidebar", key: "interests", label: "Product mentoring", metadata: {} }],
    currentVersionId: "dev-version-mentoring-1",
  },
  {
    id: "dev-block-conferences",
    kind: "interest",
    title: "Conference speaking",
    status: "archived",
    contexts: [{ type: "sidebar", key: "interests", label: "Conference speaking", metadata: {} }],
    currentVersionId: "dev-version-conferences-1",
  },
];

export const DEVELOPER_VERSION_FIXTURES = [
  {
    id: "dev-version-google-launch-1",
    blockId: "dev-block-google-launch",
    number: 1,
    schemaVersion: "1",
    content: { text: "Led the launch of a new collaboration product across three APAC markets." },
    source: { type: "human" },
    basedOnVersionId: null,
    createdAt: createdAt.early,
  },
  {
    id: "dev-version-google-launch-2",
    blockId: "dev-block-google-launch",
    number: 2,
    schemaVersion: "1",
    content: { text: "Led an evidence-driven launch across three APAC markets, reaching 120,000 activated users in the first quarter." },
    source: { type: "human" },
    basedOnVersionId: "dev-version-google-launch-1",
    createdAt: createdAt.recent,
  },
  {
    id: "dev-version-google-growth-1",
    blockId: "dev-block-google-growth",
    number: 1,
    schemaVersion: "1",
    content: { text: "Reworked onboarding using cohort analysis and customer interviews, improving 30-day retention by 18%." },
    source: { type: "human" },
    basedOnVersionId: null,
    createdAt: createdAt.middle,
  },
  {
    id: "dev-version-atlassian-research-1",
    blockId: "dev-block-atlassian-research",
    number: 1,
    schemaVersion: "1",
    content: { text: "Established a continuous discovery programme that connected weekly customer interviews to quarterly roadmap decisions." },
    source: { type: "human" },
    basedOnVersionId: null,
    createdAt: createdAt.early,
  },
  {
    id: "dev-version-product-strategy-1",
    blockId: "dev-block-product-strategy",
    number: 1,
    schemaVersion: "1",
    content: { name: "Product strategy", level: "Advanced", keywords: ["Roadmaps", "Discovery", "Prioritisation"] },
    source: { type: "human" },
    basedOnVersionId: null,
    createdAt: createdAt.early,
  },
  {
    id: "dev-version-product-strategy-2",
    blockId: "dev-block-product-strategy",
    number: 2,
    schemaVersion: "1",
    content: { name: "Product strategy and portfolio leadership", level: "Advanced", keywords: ["Portfolio strategy", "Discovery", "Prioritisation", "Executive alignment"] },
    source: { type: "human" },
    basedOnVersionId: "dev-version-product-strategy-1",
    createdAt: createdAt.recent,
  },
  {
    id: "dev-version-analytics-1",
    blockId: "dev-block-analytics",
    number: 1,
    schemaVersion: "1",
    content: { name: "Product analytics", level: "Advanced", keywords: ["SQL", "Experimentation", "Funnel analysis"] },
    source: { type: "human" },
    basedOnVersionId: null,
    createdAt: createdAt.middle,
  },
  {
    id: "dev-version-certification-1",
    blockId: "dev-block-certification",
    number: 1,
    schemaVersion: "1",
    content: { name: "Pragmatic Product Management", issuer: "Pragmatic Institute", date: "2024-09" },
    source: { type: "human" },
    basedOnVersionId: null,
    createdAt: createdAt.middle,
  },
  {
    id: "dev-version-education-1",
    blockId: "dev-block-education",
    number: 1,
    schemaVersion: "1",
    content: { institution: "RMIT University", area: "Business Information Systems", studyType: "Bachelor", startDate: "2012", endDate: "2015" },
    source: { type: "human" },
    basedOnVersionId: null,
    createdAt: createdAt.early,
  },
  {
    id: "dev-version-mentoring-1",
    blockId: "dev-block-mentoring",
    number: 1,
    schemaVersion: "1",
    content: { name: "Product mentoring", keywords: ["Early-career PMs", "Community workshops"] },
    source: { type: "human" },
    basedOnVersionId: null,
    createdAt: createdAt.middle,
  },
  {
    id: "dev-version-conferences-1",
    blockId: "dev-block-conferences",
    number: 1,
    schemaVersion: "1",
    content: { name: "Conference speaking", keywords: ["Product operations", "Discovery"] },
    source: { type: "human" },
    basedOnVersionId: null,
    createdAt: createdAt.early,
  },
];

function fixtureSelection(blockId, versionId, section, order) {
  const block = DEVELOPER_BLOCK_FIXTURES.find((item) => item.id === blockId);
  const version = DEVELOPER_VERSION_FIXTURES.find((item) => item.id === versionId);
  return {
    blockId,
    versionId,
    section,
    order,
    content: structuredClone(version.content),
    block: structuredClone(block),
  };
}

export const DEVELOPER_CV_FIXTURES = [
  {
    id: "dev-cv-product-google",
    name: "Product Manager at Google",
    status: "draft",
    themeId: "editorial",
    profile: { basics: { name: "Alex Morgan", label: "Product Manager", email: "alex@example.com", location: { city: "Melbourne", countryCode: "AU" } } },
    summary: "Product leader focused on customer discovery, measurable growth, and calm cross-functional delivery.",
    selections: [
      fixtureSelection("dev-block-google-launch", "dev-version-google-launch-2", "experience", 0),
      fixtureSelection("dev-block-google-growth", "dev-version-google-growth-1", "experience", 1),
      fixtureSelection("dev-block-atlassian-research", "dev-version-atlassian-research-1", "experience", 2),
      fixtureSelection("dev-block-product-strategy", "dev-version-product-strategy-2", "skills", 0),
      fixtureSelection("dev-block-analytics", "dev-version-analytics-1", "skills", 1),
      fixtureSelection("dev-block-education", "dev-version-education-1", "education", 0),
    ],
    createdAt: createdAt.middle,
  },
  {
    id: "dev-cv-head-marketing-facebook",
    name: "Head of Marketing at Facebook",
    status: "draft",
    themeId: "modern",
    profile: { basics: { name: "Alex Morgan", label: "Head of Marketing", email: "alex@example.com" } },
    summary: "Commercial product and growth leader translating customer insight into focused go-to-market programmes.",
    selections: [
      fixtureSelection("dev-block-google-launch", "dev-version-google-launch-1", "experience", 0),
      fixtureSelection("dev-block-google-growth", "dev-version-google-growth-1", "experience", 1),
      fixtureSelection("dev-block-product-strategy", "dev-version-product-strategy-1", "skills", 0),
      fixtureSelection("dev-block-certification", "dev-version-certification-1", "certifications", 0),
      fixtureSelection("dev-block-mentoring", "dev-version-mentoring-1", "interests", 0),
    ],
    createdAt: createdAt.recent,
  },
  {
    id: "dev-cv-product-lead",
    name: "Product Lead — Scale-up",
    slug: "alex-morgan-product-lead",
    status: "published",
    publishedRevisionId: "dev-cv-product-lead-revision-1",
    publishedAt: createdAt.recent,
    themeId: "editorial",
    profile: { basics: { name: "Alex Morgan", label: "Product Lead", email: "alex@example.com" } },
    summary: "Product lead with a record of building research habits and converting strategy into measurable adoption.",
    selections: [
      fixtureSelection("dev-block-google-launch", "dev-version-google-launch-2", "experience", 0),
      fixtureSelection("dev-block-atlassian-research", "dev-version-atlassian-research-1", "experience", 1),
      fixtureSelection("dev-block-product-strategy", "dev-version-product-strategy-2", "skills", 0),
      fixtureSelection("dev-block-certification", "dev-version-certification-1", "certifications", 0),
      fixtureSelection("dev-block-education", "dev-version-education-1", "education", 0),
    ],
    createdAt: createdAt.recent,
  },
  {
    id: "dev-cv-archived-general",
    name: "General CV — 2025",
    status: "archived",
    statusBeforeArchive: "draft",
    themeId: "modern",
    profile: { basics: { name: "Alex Morgan", label: "Product Manager", email: "alex@example.com" } },
    summary: "Archived general-purpose CV kept as a reference.",
    selections: [
      fixtureSelection("dev-block-atlassian-research", "dev-version-atlassian-research-1", "experience", 0),
      fixtureSelection("dev-block-analytics", "dev-version-analytics-1", "skills", 0),
    ],
    createdAt: createdAt.early,
  },
];

export function createDeveloperWorkspace() {
  let cvRepository;
  const blockRepository = createMemoryBlockRepository({
    initialBlocks: DEVELOPER_BLOCK_FIXTURES,
    initialVersions: DEVELOPER_VERSION_FIXTURES,
    isBlockReferenced: async (blockId) => {
      if (!cvRepository) return false;
      const cvs = await cvRepository.list();
      for (const cv of cvs) {
        const revisions = await cvRepository.listRevisions(cv.id);
        for (const revision of revisions) {
          const exact = await cvRepository.getRevision(cv.id, revision.id);
          if (exact.selections.some((selection) => selection.blockId === blockId)) return true;
        }
      }
      return false;
    },
    onDeleteBlock: async (blockId) => {
      if (cvRepository) await cvRepository.removeBlockFromWorkingCompositions(blockId);
    },
  });
  const blockLibrary = createBlockLibrary({
    repository: blockRepository,
    generator: {
      name: "developer-fixture-proposal",
      async suggest({ baseVersion, instruction }) {
        const content = structuredClone(baseVersion.content);
        const field = ["text", "name", "institution"].find((candidate) => typeof content[candidate] === "string");
        if (field) content[field] = `${content[field]} — ${instruction}`;
        return { content, generator: this.name };
      },
    },
  });
  cvRepository = createMemoryCvRepository(DEVELOPER_CV_FIXTURES, {
    clock: () => new Date("2026-07-22T02:00:00.000Z"),
    blockRepository,
  });
  const cvWorkspace = createCvWorkspace({
    repository: cvRepository,
    blockLibrary,
    summaryGenerator: {
      name: "developer-fixture-proposal",
      async suggest({ draft, instruction }) {
        return {
          text: `${draft.summary || "Experienced product leader."} ${instruction}`,
          provider: "developer-fixture",
          model: "local-example",
          createdAt: "2026-07-22T02:00:00.000Z",
        };
      },
    },
  });

  // Leave two realistic drafts in progress so block editing can target a
  // Working Composition immediately in developer access mode.
  void cvRepository.startEditingSession("dev-cv-product-google");
  void cvRepository.startEditingSession("dev-cv-head-marketing-facebook");

  return { blockLibrary, cvWorkspace };
}

export const developerWorkspace = createDeveloperWorkspace();
