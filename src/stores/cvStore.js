import { defineStore } from "pinia";
import { supabase } from "../supabase";

export const useCvStore = defineStore("cvs", {
  state: () => ({
    relevantExp: [
      "Managing SEM, SEO and Social ad campaigns for multiple products",
      "Project managing team of internal employees and freelancers",
      "Automating reporting using BI tools to internal and external stakeholders ",
    ],
    showImage: false,
    activeCV: {},
    cvs: [],
    CVsLoading: true,
    blankSlate: {
      basics: {
        name: "Nicholas Benson",
        label: "Digital Marketing Manager",
        image:
          "https://media-exp2.licdn.com/dms/image/C4D03AQGYansPbCidug/profile-displayphoto-shrink_400_400/0/1530152793273?e=1662595200&v=beta&t=f0eFX2t8gi6QGS2EtJejvAh80bTgBdhS1y2zOnB-rc0",
        email: "nic.i.benson+cv@gmail.com",
        phone: "+61 432 525 534",
        url: "https://nicbenson.com.au",
        summary: `Digital Marketing Manager, with 5+ years experience in delivering high-converting lead-generation and sales campaigns. Passion for learning new technologies and creating strategies for business success.
        `,
        location: {
          city: "Melbourne",
          countryCode: "AU",
        },
        profiles: [
          {
            network: "Linkedin",
            username: "bensonnicholas",
            url: "https://www.linkedin.com/in/bensonnicholas/",
          },
        ],
      },
      work: [
        {
          name: "E2",
          position: "Digital Marketing Manager",
          url: "https://e2language.com",
          startDate: "2021-03-01",
          endDate: "",
          summary: "Description…",
          highlights: [
            "Managing a team running multiple digital channels",
            "CRM migration project across multiple teams (Hubspot to ActiveCampaign)",
            "SEM and SEO campaigns across E2 Test Prep and E2 English brands",
            "Introduction of internal BI tools for SEM, SEO, Social, and App Performance analytics and reporting capabilities ",
            "A/B Testing of Site Enhancements with Google Optimize",
            "Designing and leading the creation of E2 English, E2 Platform, and E2 Ed Tech websites (Figma)",
            "Leading implementation of headless CMS (Strapi) across multiple product sites",
          ],
        },
        {
          name: "The Development Studio",
          position: "Digital Marketing Manager",
          url: "https://www.tds-group.com",
          startDate: "2021-01-01",
          endDate: "2021-03-01",
          summary: "Description…",
          highlights: [
            "Collaborate with internal and external stakeholders to ensure effective execution of marketing campaigns",
            "CRM management (Hubspot) and migration of CRM and marketing automations to ActiveCampaign",
            "Build new data visualisations and automated reporting with PowerBi and Google Data Studio",
            "Design and project manage the creation of new product site (AssureSuite)",

            "Create SEO analysis and execution strategies for on-page SEO, backlinks, keyword research, schema optimisation, etc.",
          ],
        },
        {
          name: "The Development Studio",
          position: "Digital Marketing Specialist",
          url: "https://www.tds-group.com",
          startDate: "2019-08-01",
          endDate: "2021-03-01",
          summary: "Description…",
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
          name: "Ipsos Australia (I-View)",
          position: "Team Leader",
          url: "https://www.ipsos.com/en-au",
          startDate: "2016-04-01",
          endDate: "2019-08-01",
          summary: "Description…",
          highlights: [
            "Coordinating up to 40 team members in telephone data collection (CATI) callroom.",
            "Rostering and administration of phone interviewers",
            "Built systems to improve workplace efficiency with Excel creating Macros with VBA",
            "Managing interviewer performance through statistical analysis and audio monitoring",
            "Reporting using Excel  from data collected in the SPSS environment to Project Managers",
            "High-intensity environment, where an eye for detail and quick problem solving were needed",
          ],
        },
      ],
      volunteer: [
        {
          organization: "Organization",
          position: "Volunteer",
          url: "https://organization.com/",
          startDate: "2012-01-01",
          endDate: "2013-01-01",
          summary: "Description…",
          highlights: ["Awarded 'Volunteer of the Month'"],
        },
      ],
      education: [
        {
          institution: "Monash University",
          url: "https://www.monash.edu/",
          area: "Bachelor Business (Marketing)",
          studyType: "University",
          startDate: "2014",
          endDate: "2018",
          score: "",
          courses: [""],
        },
      ],
      awards: [
        {
          title: "Award",
          date: "2014-11-01",
          awarder: "Company",
          summary: "There is no spoon.",
        },
      ],
      certificates: [
        {
          name: "Basic Web Design Short Course",
          date: "",
          issuer: "RMIT",
          url: "",
        },
        {
          name: "Fundamentals of Digital Marketing",
          date: "2021",
          issuer: "Google",
          url: "",
        },
        {
          name: "Hubspot Marketing Software Certification",
          date: "2021",
          issuer: "HubSpot",
          url: "",
        },
      ],
      publications: [
        {
          name: "Publication",
          publisher: "Company",
          releaseDate: "2014-10-01",
          url: "https://publication.com",
          summary: "Description…",
        },
      ],
      skills: [
        {
          name: "Digital Marketing",
          level: "High",
          keywords: ["SEO", "SEM", "Social Ads", "Lead Generation"],
        },
        {
          name: "CRM Management",
          level: "Intermediate",
          keywords: [
            "Salesforce",
            "Hubspot",
            "ActiveCampaign",
            "Saleforce APEX Development",
          ],
        },
        {
          name: "Data Visualisation",
          level: "Intermediate",
          keywords: [
            "Google Data Studio",
            "Excel",
            "Salesforce",
            "Databox",
            "Geckoboard",
          ],
        },
        {
          name: "Web Design",
          level: "Intermediate",
          keywords: ["Figma", "CSS", "HTML", "WordPress", "Elementor"],
        },
        {
          name: "Development",
          level: "Beginner",
          keywords: ["HTML", "CSS", "JavaScript", "VueJs(3)", "VBA"],
        },

        {
          name: "Project Management",
          level: "Intermediate",
          keywords: ["Jira", "Asana", "Agile"],
        },
      ],
      languages: [
        {
          language: "English",
          fluency: "Native speaker",
        },
      ],
      interests: [
        {
          name: "Sports",
          keywords: ["AFL", "Basketball"],
        },
        {
          name: "Leisure",
          keywords: ["Quizzes", "Puzzles"],
        },
        {
          name: "Web Design",
          keywords: ["HTML", "CSS", "Javscript"],
        },
      ],
      references: [
        {
          name: "Jane Doe",
          reference: "Reference…",
        },
      ],
      projects: [
        {
          name: "Crash Survivor Marketing Campaign",
          description:
            "Marketing campaign promoting The Crash Survivor short film by PLGRM",
          highlights: [
            "Campaign resulted in multiple media appearance for the client including SBS Insight, Courier Mail, HuffPost",
            "Event sponsored by Oracle",
          ],
          keywords: ["Event Promotion", "Social Advertising"],
          startDate: "2016",
          endDate: "2016",
          url: "https://www.eventbrite.com.au/e/the-crash-survivor-plgrm-premiere-tickets-29292731348",
          roles: ["Marketing Lead"],
          entity:
            "Image Group International, Doug Wright 'Will Never Give Up' ",
          type: "Campaign",
        },
        {
          name: "E2 Site Redesign",
          description: "Using E2's new brand and re",
          highlights: [
            "Campaign resulted in multiple media appearance for the client including SBS Insight, Courier Mail, HuffPost",
            "Event sponsored by Oracle",
          ],
          keywords: ["Website Redesign", "Figma"],
          startDate: "2016",
          endDate: "2016",
          url: "https://www.eventbrite.com.au/e/the-crash-survivor-plgrm-premiere-tickets-29292731348",
          roles: ["Marketing Lead"],
          entity:
            "Image Group International, Doug Wright 'Will Never Give Up' ",
          type: "Campaign",
        },
      ],
    },
  }),
  actions: {
    async getCVs() {
      this.CVsLoading = true;
      const { data, error } = await supabase.from("CVs").select();
      console.log("from pinia get CVS function: ", data);
      if (error) throw error;
      this.cvs = data;
      this.CVsLoading = false;
    },
  },
});
