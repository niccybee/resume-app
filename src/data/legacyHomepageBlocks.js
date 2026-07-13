const jobs = [
  {
    company: "E2",
    role: "Digital Marketing Manager",
    url: "https://e2language.com",
    startDate: "2021-03-01",
    endDate: "",
    highlights: [
      "Managing a team running multiple digital channels",
      "CRM migration project across multiple teams (Hubspot to ActiveCampaign)",
      "SEM and SEO campaigns across E2 Test Prep and E2 English brands",
      "Introduction of internal BI tools for SEM, SEO, Social, and App Performance analytics and reporting capabilities",
      "A/B Testing of Site Enhancements with Google Optimize",
      "Designing and leading the creation of E2 English, E2 Platform, and E2 Ed Tech websites (Figma)",
      "Leading implementation of headless CMS (Strapi) across multiple product sites",
    ],
  },
  {
    company: "The Development Studio",
    role: "Digital Marketing Manager",
    url: "https://www.tds-group.com",
    startDate: "2021-01-01",
    endDate: "2021-03-01",
    highlights: [
      "Collaborate with internal and external stakeholders to ensure effective execution of marketing campaigns",
      "CRM management (Hubspot) and migration of CRM and marketing automations to ActiveCampaign",
      "Build new data visualisations and automated reporting with PowerBi and Google Data Studio",
      "Design and project manage the creation of new product site (AssureSuite)",
      "Create SEO analysis and execution strategies for on-page SEO, backlinks, keyword research, schema optimisation, etc.",
    ],
  },
  {
    company: "The Development Studio",
    role: "Digital Marketing Specialist",
    url: "https://www.tds-group.com",
    startDate: "2019-08-01",
    endDate: "2021-03-01",
    highlights: [
      "Build and identify new target audiences and grow email list through lead generation campaigns",
      "Plan, build, implement and optimise direct email marketing campaigns",
      "Build workflows, segments, and map customer touch points using the CRM",
      "Manage WordPress blogs and collaborate with writers for 20% organic search boost",
      "Help optimise multimedia channels such as YouTube and Podcast",
      "Pull raw CSV data, analyse, and submit reports on campaign progress and provide recommendations for campaign optimisation.",
      "Automate reporting process through Google Data Studio",
      "Create and SEM, and social ads(FB, Instagram) to effectively reach a bigger audience and generate quality leads",
    ],
  },
  {
    company: "Ipsos Australia (I-View)",
    role: "Team Leader",
    url: "https://www.ipsos.com/en-au",
    startDate: "2016-04-01",
    endDate: "2019-08-01",
    highlights: [
      "Coordinating up to 40 team members in telephone data collection (CATI) callroom.",
      "Rostering and administration of phone interviewers",
      "Built systems to improve workplace efficiency with Excel creating Macros with VBA",
      "Managing interviewer performance through statistical analysis and audio monitoring",
      "Reporting using Excel from data collected in the SPSS environment to Project Managers",
      "High-intensity environment, where an eye for detail and quick problem solving were needed",
    ],
  },
];

const skills = [
  { name: "Digital Marketing", level: "High", keywords: ["SEO", "SEM", "Social Ads", "Lead Generation"] },
  { name: "CRM Management", level: "Intermediate", keywords: ["Salesforce", "Hubspot", "ActiveCampaign", "Salesforce APEX Development"] },
  { name: "Data Visualisation", level: "Intermediate", keywords: ["Google Data Studio", "Excel", "Salesforce", "Databox", "Geckoboard"] },
  { name: "Web Design", level: "Intermediate", keywords: ["Figma", "CSS", "HTML", "WordPress", "Elementor"] },
  { name: "Development", level: "Beginner", keywords: ["HTML", "CSS", "JavaScript", "VueJs(3)", "VBA"] },
  { name: "Project Management", level: "Intermediate", keywords: ["Jira", "Asana", "Agile"] },
];

const certifications = [
  { name: "Basic Web Design Short Course", date: "", issuer: "RMIT", url: "" },
  { name: "Fundamentals of Digital Marketing", date: "2021", issuer: "Google", url: "" },
  { name: "Hubspot Marketing Software Certification", date: "2021", issuer: "HubSpot", url: "" },
];

const education = [
  { institution: "Monash University", url: "https://www.monash.edu/", area: "Bachelor Business (Marketing)", studyType: "University", startDate: "2014", endDate: "2018", score: "", courses: [] },
];

const interests = [
  { name: "Sports", keywords: ["AFL", "Basketball"] },
  { name: "Leisure", keywords: ["Quizzes", "Puzzles"] },
  { name: "Web Design", keywords: ["HTML", "CSS", "JavaScript"] },
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function legacyHomepageBlockInputs() {
  const experience = jobs.flatMap((job) =>
    job.highlights.map((text, index) => ({
      legacyKey: `homepage:experience:${slug(job.company)}:${slug(job.role)}:${index + 1}`,
      kind: "experience",
      title: text,
      content: { text },
      contexts: [{
        type: "employment",
        key: `${slug(job.company)}-${slug(job.role)}`,
        label: `${job.company} · ${job.role}`,
        metadata: {
          companyId: slug(job.company),
          company: job.company,
          roleId: slug(job.role),
          role: job.role,
          url: job.url,
          startDate: job.startDate,
          endDate: job.endDate,
        },
      }],
    })),
  );

  const sidebar = [
    ...skills.map((content) => ({ legacyKey: `homepage:skill:${slug(content.name)}`, kind: "skill", title: content.name, content })),
    ...certifications.map((content) => ({ legacyKey: `homepage:certification:${slug(content.name)}`, kind: "certification", title: content.name, content })),
    ...education.map((content) => ({ legacyKey: `homepage:education:${slug(content.institution)}`, kind: "education", title: `${content.institution} — ${content.area}`, content })),
    ...interests.map((content) => ({ legacyKey: `homepage:interest:${slug(content.name)}`, kind: "interest", title: content.name, content })),
  ].map((input) => ({
    ...input,
    contexts: [{ type: "sidebar", key: `${input.kind}s`, label: input.title, metadata: {} }],
  }));

  return [...experience, ...sidebar];
}

