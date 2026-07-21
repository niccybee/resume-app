import { describe, expect, it } from "vitest";
import { exportCvRevision } from "./compositionAdapterRegistry";

function experienceSelection({ id, order, occasionId, role, startDate, endDate, text, metadata = {} }) {
  const employment = {
    employerId: "acme",
    employer: "Acme",
    roleId: role.toLowerCase().replaceAll(" ", "-"),
    role,
    occasionId,
    startDate,
    endDate,
    ...metadata,
  };
  return {
    blockId: `block-${id}`,
    versionId: `version-${id}`,
    section: "experience",
    order,
    group: employment,
    content: { text, resumeStudioVersionId: `internal-${id}` },
    block: {
      kind: "experience",
      title: text,
      contexts: [{ type: "employment", key: occasionId, metadata: employment }],
    },
  };
}

function completeRevision(overrides = {}) {
  return {
    id: "revision-7",
    cvId: "cv-1",
    number: 7,
    schemaVersion: "internal-2",
    profile: {
      basics: {
        name: "Nic Benson",
        label: "Product Leader",
        image: "https://example.com/nic.jpg",
        email: "nic@example.com",
        phone: "+61 400 000 000",
        url: "https://example.com",
        summary: "Superseded profile summary.",
        location: {
          address: "1 Example Street",
          postalCode: "3000",
          city: "Melbourne",
          countryCode: "AU",
          region: "Victoria",
          timezone: "Australia/Melbourne",
        },
        profiles: [{
          network: "LinkedIn",
          username: "nic",
          url: "https://linkedin.com/in/nic",
          resumeStudioProfileId: "profile-1",
        }],
        resumeStudioOwnerId: "user-1",
      },
      internalProfileVersion: 4,
    },
    summary: "Versioned CV Revision summary.",
    summaryProvenance: { type: "ai", model: "private-model" },
    selections: [
      experienceSelection({
        id: "launch", order: 0, occasionId: "acme-product-manager-2022", role: "Product Manager",
        startDate: "2022", endDate: "present", text: "Launched a new platform.",
        metadata: { location: "Melbourne", url: "https://acme.example", summary: "Led platform strategy." },
      }),
      experienceSelection({
        id: "growth", order: 1, occasionId: "acme-product-manager-2022", role: "Product Manager",
        startDate: "2022", endDate: "present", text: "Grew activation by 30%.",
        metadata: { location: "Melbourne", url: "https://acme.example", summary: "Led platform strategy." },
      }),
      experienceSelection({
        id: "earlier", order: 2, occasionId: "acme-head-product-2020", role: "Head of Product",
        startDate: "2020-02", endDate: "2021-03-14", text: "Built the first product team.",
      }),
      {
        blockId: "block-skill", versionId: "version-skill", section: "skills", order: 0,
        block: { kind: "skill", title: "Product Strategy" },
        content: { name: "Product Strategy", level: "Advanced", keywords: ["Discovery", "Roadmaps"], internalId: "omit" },
      },
      {
        blockId: "block-cert", versionId: "version-cert", section: "certifications", order: 0,
        block: { kind: "certification", title: "Product Analytics" },
        content: { name: "Product Analytics", date: "2024", issuer: "Reforge", url: "https://example.com/cert", source: "omit" },
      },
      {
        blockId: "block-education", versionId: "version-education", section: "education", order: 0,
        block: { kind: "education", title: "Monash University" },
        content: {
          institution: "Monash University", url: "https://monash.edu", area: "Marketing", studyType: "Bachelor",
          startDate: "2014-02", endDate: "2018", score: "Distinction", courses: ["Product Management"], blockVersionId: "omit",
        },
      },
      {
        blockId: "block-interest", versionId: "version-interest", section: "interests", order: 0,
        block: { kind: "interest", title: "Sport" },
        content: { name: "Sport", keywords: ["AFL", "Basketball"], provenance: "omit" },
      },
    ],
    ...overrides,
  };
}

describe("versioned CV Composition adapters", () => {
  it("exports a complete immutable CV Revision as a clean JSON Resume payload", () => {
    expect(exportCvRevision({ revision: completeRevision() })).toEqual({
      adapter: "json-resume",
      adapterVersion: "1",
      payload: {
        $schema: "https://raw.githubusercontent.com/jsonresume/jsonresume.org/master/packages/schema/schema.json",
        basics: {
          name: "Nic Benson",
          label: "Product Leader",
          image: "https://example.com/nic.jpg",
          email: "nic@example.com",
          phone: "+61 400 000 000",
          url: "https://example.com",
          summary: "Versioned CV Revision summary.",
          location: {
            address: "1 Example Street",
            postalCode: "3000",
            city: "Melbourne",
            countryCode: "AU",
            region: "Victoria",
          },
          profiles: [{ network: "LinkedIn", username: "nic", url: "https://linkedin.com/in/nic" }],
        },
        work: [{
          name: "Acme",
          location: "Melbourne",
          position: "Product Manager",
          url: "https://acme.example",
          startDate: "2022",
          summary: "Led platform strategy.",
          highlights: ["Launched a new platform.", "Grew activation by 30%."],
        }, {
          name: "Acme",
          position: "Head of Product",
          startDate: "2020-02",
          endDate: "2021-03-14",
          highlights: ["Built the first product team."],
        }],
        skills: [{ name: "Product Strategy", level: "Advanced", keywords: ["Discovery", "Roadmaps"] }],
        certificates: [{ name: "Product Analytics", date: "2024", url: "https://example.com/cert", issuer: "Reforge" }],
        education: [{
          institution: "Monash University", url: "https://monash.edu", area: "Marketing", studyType: "Bachelor",
          startDate: "2014-02", endDate: "2018", score: "Distinction", courses: ["Product Management"],
        }],
        interests: [{ name: "Sport", keywords: ["AFL", "Basketball"] }],
      },
    });
  });

  it.each(["Spring 2022", "2024-13", "2024/01/01"])("rejects unsupported date value %s from a complete export", (startDate) => {
    const revision = completeRevision();
    revision.selections[0].group.startDate = startDate;
    revision.selections[0].block.contexts[0].metadata.startDate = startDate;

    expect(() => exportCvRevision({ revision })).toThrow(expect.objectContaining({ code: "validation-failed" }));
  });

  it("rejects an unsupported adapter version explicitly", () => {
    expect(() => exportCvRevision({ revision: completeRevision(), adapterVersion: "2" }))
      .toThrow(expect.objectContaining({ code: "unsupported-schema-version" }));
  });

  it("does not resurrect a legacy profile summary when the selected Revision cleared it", () => {
    const exported = exportCvRevision({ revision: completeRevision({ summary: "" }) });
    expect(exported.payload.basics).toEqual({
      name: "Nic Benson",
      label: "Product Leader",
      image: "https://example.com/nic.jpg",
      email: "nic@example.com",
      phone: "+61 400 000 000",
      url: "https://example.com",
      location: {
        address: "1 Example Street",
        postalCode: "3000",
        city: "Melbourne",
        countryCode: "AU",
        region: "Victoria",
      },
      profiles: [{ network: "LinkedIn", username: "nic", url: "https://linkedin.com/in/nic" }],
    });
  });
});
