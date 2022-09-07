import { defineStore, storeToRefs, createPinia } from "pinia";
import { useRoute, createRouter, createWebHistory } from "vue-router";
import { resolveComponent, mergeProps, unref, withCtx, openBlock, createBlock, createCommentVNode, createVNode, toDisplayString, createTextVNode, Fragment, renderList, useSSRContext, ref, reactive, onMounted, computed } from "vue";
import { ssrRenderAttrs, ssrRenderStyle, ssrInterpolate, ssrRenderList, ssrRenderComponent, ssrRenderAttr, ssrRenderClass } from "vue/server-renderer";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { ViteSSG } from "vite-ssg";
const supabaseUrl = "https://qspbcpskctpahamtbrgk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTYyNTIwODIzMSwiZXhwIjoxOTQwNzg0MjMxfQ.wCCsA-w7mtgsbhhTZ_y-glaaxpztIRzLIABd6cJLm7g";
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const useCvStore = defineStore("cvs", {
  state: () => ({
    relevantExp: [
      "Managing SEM, SEO and Social ad campaigns for multiple products",
      "Project managing team of internal employees and freelancers",
      "Automating reporting using BI tools to internal and external stakeholders "
    ],
    showImage: false,
    activeCV: {},
    cvs: [],
    CVsLoading: true,
    blankSlate: {
      basics: {
        name: "Nicholas Benson",
        label: "Digital Marketing Manager",
        image: "https://media-exp2.licdn.com/dms/image/C4D03AQGYansPbCidug/profile-displayphoto-shrink_400_400/0/1530152793273?e=1662595200&v=beta&t=f0eFX2t8gi6QGS2EtJejvAh80bTgBdhS1y2zOnB-rc0",
        email: "nic.i.benson+cv@gmail.com",
        phone: "+61 432 525 534",
        url: "https://nicbenson.com.au",
        summary: `Digital Marketing Manager, with 5+ years experience in delivering high-converting lead-generation and sales campaigns. Passion for learning new technologies and creating strategies for business success.
        `,
        location: {
          city: "Melbourne",
          countryCode: "AU"
        },
        profiles: [
          {
            network: "Linkedin",
            username: "bensonnicholas",
            url: "https://www.linkedin.com/in/bensonnicholas/"
          }
        ]
      },
      work: [
        {
          name: "E2",
          position: "Digital Marketing Manager",
          url: "https://e2language.com",
          startDate: "2021-03-01",
          endDate: "",
          summary: "Description\u2026",
          highlights: [
            "Managing a team running multiple digital channels",
            "CRM migration project across multiple teams (Hubspot to ActiveCampaign)",
            "SEM and SEO campaigns across E2 Test Prep and E2 English brands",
            "Introduction of internal BI tools for SEM, SEO, Social, and App Performance analytics and reporting capabilities ",
            "A/B Testing of Site Enhancements with Google Optimize",
            "Designing and leading the creation of E2 English, E2 Platform, and E2 Ed Tech websites (Figma)",
            "Leading implementation of headless CMS (Strapi) across multiple product sites"
          ]
        },
        {
          name: "The Development Studio",
          position: "Digital Marketing Manager",
          url: "https://www.tds-group.com",
          startDate: "2021-01-01",
          endDate: "2021-03-01",
          summary: "Description\u2026",
          highlights: [
            "Collaborate with internal and external stakeholders to ensure effective execution of marketing campaigns",
            "CRM management (Hubspot) and migration of CRM and marketing automations to ActiveCampaign",
            "Build new data visualisations and automated reporting with PowerBi and Google Data Studio",
            "Design and project manage the creation of new product site (AssureSuite)",
            "Create SEO analysis and execution strategies for on-page SEO, backlinks, keyword research, schema optimisation, etc."
          ]
        },
        {
          name: "The Development Studio",
          position: "Digital Marketing Specialist",
          url: "https://www.tds-group.com",
          startDate: "2019-08-01",
          endDate: "2021-03-01",
          summary: "Description\u2026",
          highlights: [
            "Build and identify new target audiences and grow email list through lead generation campaigns",
            "Plan, build, implement and optimise direct email marketing campaigns",
            "Build workflows, segments, and map customer touch points using the CRM",
            "Manage WordPress blogs and collaborate with writers for 20% organic search boost",
            "Help optimise multimedia channels such as YouTube and Podcast",
            "Pull raw CSV data, analyse, and submit reports on campaign progress and provide recommendations for campaign optimisation.",
            "Automate reporting process through Google Data Studio",
            "Create and SEM, and social ads(FB, Instagram) to effectively reach a bigger audience and generate quality leads"
          ]
        },
        {
          name: "Ipsos Australia (I-View)",
          position: "Team Leader",
          url: "https://www.ipsos.com/en-au",
          startDate: "2016-04-01",
          endDate: "2019-08-01",
          summary: "Description\u2026",
          highlights: [
            "Coordinating up to 40 team members in telephone data collection (CATI) callroom.",
            "Rostering and administration of phone interviewers",
            "Built systems to improve workplace efficiency with Excel creating Macros with VBA",
            "Managing interviewer performance through statistical analysis and audio monitoring",
            "Reporting using Excel  from data collected in the SPSS environment to Project Managers",
            "High-intensity environment, where an eye for detail and quick problem solving were needed"
          ]
        }
      ],
      volunteer: [
        {
          organization: "Organization",
          position: "Volunteer",
          url: "https://organization.com/",
          startDate: "2012-01-01",
          endDate: "2013-01-01",
          summary: "Description\u2026",
          highlights: ["Awarded 'Volunteer of the Month'"]
        }
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
          courses: [""]
        }
      ],
      awards: [
        {
          title: "Award",
          date: "2014-11-01",
          awarder: "Company",
          summary: "There is no spoon."
        }
      ],
      certificates: [
        {
          name: "Basic Web Design Short Course",
          date: "",
          issuer: "RMIT",
          url: ""
        },
        {
          name: "Fundamentals of Digital Marketing",
          date: "2021",
          issuer: "Google",
          url: ""
        },
        {
          name: "Hubspot Marketing Software Certification",
          date: "2021",
          issuer: "HubSpot",
          url: ""
        }
      ],
      publications: [
        {
          name: "Publication",
          publisher: "Company",
          releaseDate: "2014-10-01",
          url: "https://publication.com",
          summary: "Description\u2026"
        }
      ],
      skills: [
        {
          name: "Digital Marketing",
          level: "High",
          keywords: ["SEO", "SEM", "Social Ads", "Lead Generation"]
        },
        {
          name: "CRM Management",
          level: "Intermediate",
          keywords: [
            "Salesforce",
            "Hubspot",
            "ActiveCampaign",
            "Saleforce APEX Development"
          ]
        },
        {
          name: "Data Visualisation",
          level: "Intermediate",
          keywords: [
            "Google Data Studio",
            "Excel",
            "Salesforce",
            "Databox",
            "Geckoboard"
          ]
        },
        {
          name: "Web Design",
          level: "Intermediate",
          keywords: ["Figma", "CSS", "HTML", "WordPress", "Elementor"]
        },
        {
          name: "Development",
          level: "Beginner",
          keywords: ["HTML", "CSS", "JavaScript", "VueJs(3)", "VBA"]
        },
        {
          name: "Project Management",
          level: "Intermediate",
          keywords: ["Jira", "Asana", "Agile"]
        }
      ],
      languages: [
        {
          language: "English",
          fluency: "Native speaker"
        }
      ],
      interests: [
        {
          name: "Sports",
          keywords: ["AFL", "Basketball"]
        },
        {
          name: "Leisure",
          keywords: ["Quizzes", "Puzzles"]
        },
        {
          name: "Web Design",
          keywords: ["HTML", "CSS", "Javscript"]
        }
      ],
      references: [
        {
          name: "Jane Doe",
          reference: "Reference\u2026"
        }
      ],
      projects: [
        {
          name: "Crash Survivor Marketing Campaign",
          description: "Marketing campaign promoting The Crash Survivor short film by PLGRM",
          highlights: [
            "Campaign resulted in multiple media appearance for the client including SBS Insight, Courier Mail, HuffPost",
            "Event sponsored by Oracle"
          ],
          keywords: ["Event Promotion", "Social Advertising"],
          startDate: "2016",
          endDate: "2016",
          url: "https://www.eventbrite.com.au/e/the-crash-survivor-plgrm-premiere-tickets-29292731348",
          roles: ["Marketing Lead"],
          entity: "Image Group International, Doug Wright 'Will Never Give Up' ",
          type: "Campaign"
        },
        {
          name: "E2 Site Redesign",
          description: "Using E2's new brand and re",
          highlights: [
            "Campaign resulted in multiple media appearance for the client including SBS Insight, Courier Mail, HuffPost",
            "Event sponsored by Oracle"
          ],
          keywords: ["Website Redesign", "Figma"],
          startDate: "2016",
          endDate: "2016",
          url: "https://www.eventbrite.com.au/e/the-crash-survivor-plgrm-premiere-tickets-29292731348",
          roles: ["Marketing Lead"],
          entity: "Image Group International, Doug Wright 'Will Never Give Up' ",
          type: "Campaign"
        }
      ]
    }
  }),
  actions: {
    async getCVs() {
      this.CVsLoading = true;
      const { data, error } = await supabase.from("CVs").select();
      console.log("from pinia: ", data);
      if (error)
        throw error;
      this.cvs = data;
      this.CVsLoading = false;
    }
  }
});
var Profile_vue_vue_type_style_index_0_lang = "";
const _sfc_main$k = {
  name: "Profile",
  __ssrInlineRender: true,
  props: ["profileInfo"],
  setup(__props) {
    const props = __props;
    const profile = props.profileInfo;
    const relevantExp = props.profileInfo[2];
    const showImage = props.profileInfo[3];
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      _push(`<div${ssrRenderAttrs(mergeProps({
        id: "profile",
        class: "grid"
      }, _attrs))}><div id="basics"><div class="flex"><div><h3 style="${ssrRenderStyle({ "margin-bottom": "1rem" })}">Summary</h3><p style="${ssrRenderStyle({ "font-size": "0.8rem" })}">${ssrInterpolate(unref(profile)[0].summary)}</p></div></div><div></div><div class="flex"><div><h3 style="${ssrRenderStyle({ "margin-bottom": "1rem" })}">Relevant Experience</h3><ul><!--[-->`);
      ssrRenderList(unref(relevantExp), (r) => {
        _push(`<li style="${ssrRenderStyle({ "font-size": "0.8rem" })}">${ssrInterpolate(r)}</li>`);
      });
      _push(`<!--]--></ul></div></div></div><article class="cv-sidebar-article" style="${ssrRenderStyle({ "padding-top": "0.6rem", "padding-bottom": "0.4rem", "box-shadow": "0 0 0", "border": "lightgray solid 1px" })}"><div>`);
      _push(ssrRenderComponent(_component_hgroup, null, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            if (unref(showImage)) {
              _push2(`<img style="${ssrRenderStyle({ "max-width": "100px", "border-radius": "0.2rem" })}" src="https://media-exp2.licdn.com/dms/image/C4D03AQGYansPbCidug/profile-displayphoto-shrink_400_400/0/1530152793273?e=1662595200&amp;v=beta&amp;t=f0eFX2t8gi6QGS2EtJejvAh80bTgBdhS1y2zOnB-rc0" alt=""${_scopeId}>`);
            } else {
              _push2(`<!---->`);
            }
            _push2(`<h4 class="cv-sidebar-header"${_scopeId}>Personal Details</h4><p${_scopeId}><span${_scopeId}>${ssrInterpolate(unref(profile)[0].name)},</span> <br${_scopeId}><span${_scopeId}>${ssrInterpolate(unref(profile)[0].label)}</span> <br${_scopeId}><hr${_scopeId}> \u{1F4CD} <!--[-->`);
            ssrRenderList(unref(profile)[0].location, (l, i) => {
              _push2(`<span class="cv-sidebar-content"${_scopeId}>${ssrInterpolate(l + " ")}</span>`);
            });
            _push2(`<!--]--> <br${_scopeId}><a class="cv-sidebar-content"${ssrRenderAttr("href", "mailto:" + unref(profile)[0].email)}${_scopeId}>\u{1F4E7}</a> | <a class="cv-sidebar-content"${ssrRenderAttr("href", unref(profile)[0].url)}${_scopeId}><span${_scopeId}>\u{1F310} | </span></a><!--[-->`);
            ssrRenderList(unref(profile)[0].profiles, (p) => {
              _push2(`<a class="cv-sidebar-content" href="p.url"${_scopeId}><span class="cv-sidebar-content"${_scopeId}>${ssrInterpolate(p.network)}</span></a>`);
            });
            _push2(`<!--]--> | <br${_scopeId}><span class="cv-sidebar-content"${_scopeId}><a${ssrRenderAttr("href", "tel:" + unref(profile)[0].phone)}${_scopeId}>${ssrInterpolate(unref(profile)[0].phone)}</a></span></p>`);
          } else {
            return [
              unref(showImage) ? (openBlock(), createBlock("img", {
                key: 0,
                style: { "max-width": "100px", "border-radius": "0.2rem" },
                src: "https://media-exp2.licdn.com/dms/image/C4D03AQGYansPbCidug/profile-displayphoto-shrink_400_400/0/1530152793273?e=1662595200&v=beta&t=f0eFX2t8gi6QGS2EtJejvAh80bTgBdhS1y2zOnB-rc0",
                alt: ""
              })) : createCommentVNode("", true),
              createVNode("h4", { class: "cv-sidebar-header" }, "Personal Details"),
              createVNode("p", null, [
                createVNode("span", null, toDisplayString(unref(profile)[0].name) + ",", 1),
                createTextVNode(),
                createVNode("br"),
                createVNode("span", null, toDisplayString(unref(profile)[0].label), 1),
                createTextVNode(),
                createVNode("br"),
                createVNode("hr"),
                createTextVNode(" \u{1F4CD} "),
                (openBlock(true), createBlock(Fragment, null, renderList(unref(profile)[0].location, (l, i) => {
                  return openBlock(), createBlock("span", { class: "cv-sidebar-content" }, toDisplayString(l + " "), 1);
                }), 256)),
                createTextVNode(),
                createVNode("br"),
                createVNode("a", {
                  class: "cv-sidebar-content",
                  href: "mailto:" + unref(profile)[0].email
                }, "\u{1F4E7}", 8, ["href"]),
                createTextVNode(" | "),
                createVNode("a", {
                  class: "cv-sidebar-content",
                  href: unref(profile)[0].url
                }, [
                  createVNode("span", null, "\u{1F310} | ")
                ], 8, ["href"]),
                (openBlock(true), createBlock(Fragment, null, renderList(unref(profile)[0].profiles, (p) => {
                  return openBlock(), createBlock("a", {
                    class: "cv-sidebar-content",
                    href: "p.url"
                  }, [
                    createVNode("span", { class: "cv-sidebar-content" }, toDisplayString(p.network), 1)
                  ]);
                }), 256)),
                createTextVNode(" | "),
                createVNode("br"),
                createVNode("span", { class: "cv-sidebar-content" }, [
                  createVNode("a", {
                    href: "tel:" + unref(profile)[0].phone
                  }, toDisplayString(unref(profile)[0].phone), 9, ["href"])
                ])
              ])
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`<div></div></div></article></div>`);
    };
  }
};
const _sfc_setup$k = _sfc_main$k.setup;
_sfc_main$k.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/CV/Profile.vue");
  return _sfc_setup$k ? _sfc_setup$k(props, ctx) : void 0;
};
var Work_vue_vue_type_style_index_0_lang = "";
const _sfc_main$j = {
  name: "Work",
  __ssrInlineRender: true,
  props: ["workInfo"],
  setup(__props) {
    const props = __props;
    const work = props.workInfo;
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      _push(`<div${ssrRenderAttrs(mergeProps({ id: "work" }, _attrs))}><h3 style="${ssrRenderStyle({ "margin-bottom": "1rem" })}">Past Experience</h3><!--[-->`);
      ssrRenderList(unref(work), (w) => {
        _push(`<div id="work-item" class="container">`);
        _push(ssrRenderComponent(_component_hgroup, null, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(`<h5${_scopeId}>${ssrInterpolate(w.name)} <span${_scopeId}>`);
              if (w.url) {
                _push2(`<a target="_blank"${ssrRenderAttr("href", w.url)}${_scopeId}></a>`);
              } else {
                _push2(`<!---->`);
              }
              _push2(`</span></h5><p${_scopeId}>${ssrInterpolate(w.position)} <br${_scopeId}><sub${_scopeId}>${ssrInterpolate(w.startDate)} - ${ssrInterpolate(w.endDate)}</sub></p>`);
            } else {
              return [
                createVNode("h5", null, [
                  createTextVNode(toDisplayString(w.name) + " ", 1),
                  createVNode("span", null, [
                    w.url ? (openBlock(), createBlock("a", {
                      key: 0,
                      target: "_blank",
                      href: w.url
                    }, null, 8, ["href"])) : createCommentVNode("", true)
                  ])
                ]),
                createVNode("p", null, [
                  createTextVNode(toDisplayString(w.position) + " ", 1),
                  createVNode("br"),
                  createVNode("sub", null, toDisplayString(w.startDate) + " - " + toDisplayString(w.endDate), 1)
                ])
              ];
            }
          }),
          _: 2
        }, _parent));
        _push(`<div><ul><!--[-->`);
        ssrRenderList(w.highlights, (h) => {
          _push(`<li>${ssrInterpolate(h)}</li>`);
        });
        _push(`<!--]--></ul></div><hr></div>`);
      });
      _push(`<!--]--></div>`);
    };
  }
};
const _sfc_setup$j = _sfc_main$j.setup;
_sfc_main$j.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/CV/Work.vue");
  return _sfc_setup$j ? _sfc_setup$j(props, ctx) : void 0;
};
const _sfc_main$i = {
  name: "Certifications",
  __ssrInlineRender: true,
  props: {
    certificates: Array
  },
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      _push(`<article${ssrRenderAttrs(mergeProps({ class: "cv-sidebar-article" }, _attrs))}><h4 class="cv-sidebar-header">Certifications</h4><!--[-->`);
      ssrRenderList(__props.certificates, (c, i) => {
        _push(`<div>`);
        _push(ssrRenderComponent(_component_hgroup, null, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(`<h6${_scopeId}>${ssrInterpolate(c.name)}</h6><p class="cv-sidebar-content"${_scopeId}><span${_scopeId}>${ssrInterpolate(c.issuer)}</span> <span${_scopeId}>${ssrInterpolate(c.date ? ` - ${c.date}` : "")}</span></p>`);
            } else {
              return [
                createVNode("h6", null, toDisplayString(c.name), 1),
                createVNode("p", { class: "cv-sidebar-content" }, [
                  createVNode("span", null, toDisplayString(c.issuer), 1),
                  createTextVNode(),
                  createVNode("span", null, toDisplayString(c.date ? ` - ${c.date}` : ""), 1)
                ])
              ];
            }
          }),
          _: 2
        }, _parent));
        _push(`</div>`);
      });
      _push(`<!--]--></article>`);
    };
  }
};
const _sfc_setup$i = _sfc_main$i.setup;
_sfc_main$i.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/CV/Certifications.vue");
  return _sfc_setup$i ? _sfc_setup$i(props, ctx) : void 0;
};
const _sfc_main$h = {
  name: "Languages",
  __ssrInlineRender: true,
  props: {
    languages: Array
  },
  setup(__props) {
    const props = __props;
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      _push(`<article${ssrRenderAttrs(mergeProps({ class: "cv-sidebar-article" }, _attrs))}>`);
      _push(ssrRenderComponent(_component_hgroup, null, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<h4 class="cv-sidebar-header"${_scopeId}>Languages</h4><!--[-->`);
            ssrRenderList(props.languages, (l) => {
              _push2(`<p class="cv-sidebar-content"${_scopeId}>${ssrInterpolate(l.language)}: ${ssrInterpolate(l.fluency)}</p>`);
            });
            _push2(`<!--]-->`);
          } else {
            return [
              createVNode("h4", { class: "cv-sidebar-header" }, "Languages"),
              (openBlock(true), createBlock(Fragment, null, renderList(props.languages, (l) => {
                return openBlock(), createBlock("p", { class: "cv-sidebar-content" }, toDisplayString(l.language) + ": " + toDisplayString(l.fluency), 1);
              }), 256))
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</article>`);
    };
  }
};
const _sfc_setup$h = _sfc_main$h.setup;
_sfc_main$h.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/CV/Languages.vue");
  return _sfc_setup$h ? _sfc_setup$h(props, ctx) : void 0;
};
const _sfc_main$g = {
  name: "Interests",
  __ssrInlineRender: true,
  props: {
    interests: Array
  },
  setup(__props) {
    const props = __props;
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      _push(`<article${ssrRenderAttrs(mergeProps({ class: "cv-sidebar-article" }, _attrs))}><h4 class="cv-sidebar-header">Interests</h4><!--[-->`);
      ssrRenderList(props.interests, (i) => {
        _push(ssrRenderComponent(_component_hgroup, null, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(`<h6${_scopeId}>${ssrInterpolate(i.name)}</h6><p class="cv-sidebar-content"${_scopeId}><!--[-->`);
              ssrRenderList(i.keywords, (k) => {
                _push2(`<span${_scopeId}>${ssrInterpolate(k ? `${k}, ` : "")}</span>`);
              });
              _push2(`<!--]--></p>`);
            } else {
              return [
                createVNode("h6", null, toDisplayString(i.name), 1),
                createVNode("p", { class: "cv-sidebar-content" }, [
                  (openBlock(true), createBlock(Fragment, null, renderList(i.keywords, (k) => {
                    return openBlock(), createBlock("span", null, toDisplayString(k ? `${k}, ` : ""), 1);
                  }), 256))
                ])
              ];
            }
          }),
          _: 2
        }, _parent));
      });
      _push(`<!--]--></article>`);
    };
  }
};
const _sfc_setup$g = _sfc_main$g.setup;
_sfc_main$g.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/CV/Interests.vue");
  return _sfc_setup$g ? _sfc_setup$g(props, ctx) : void 0;
};
const _sfc_main$f = {
  name: "Skills",
  __ssrInlineRender: true,
  props: {
    skills: Array
  },
  setup(__props) {
    const props = __props;
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      _push(`<article${ssrRenderAttrs(mergeProps({
        class: "cv-sidebar-article",
        id: "skills"
      }, _attrs))}><h4 class="cv-sidebar-header">Skills</h4><!--[-->`);
      ssrRenderList(props.skills, (s) => {
        _push(ssrRenderComponent(_component_hgroup, null, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(`<h6${_scopeId}>${ssrInterpolate(s.name)}:</h6><!--[-->`);
              ssrRenderList(s.keywords, (k) => {
                _push2(`<span class="cv-sidebar-content"${_scopeId}>${ssrInterpolate(k + ", ")}</span>`);
              });
              _push2(`<!--]--><span${_scopeId}></span>`);
            } else {
              return [
                createVNode("h6", null, toDisplayString(s.name) + ":", 1),
                (openBlock(true), createBlock(Fragment, null, renderList(s.keywords, (k) => {
                  return openBlock(), createBlock("span", { class: "cv-sidebar-content" }, toDisplayString(k + ", "), 1);
                }), 256)),
                createVNode("span")
              ];
            }
          }),
          _: 2
        }, _parent));
      });
      _push(`<!--]--></article>`);
    };
  }
};
const _sfc_setup$f = _sfc_main$f.setup;
_sfc_main$f.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/CV/Skills.vue");
  return _sfc_setup$f ? _sfc_setup$f(props, ctx) : void 0;
};
var Education_vue_vue_type_style_index_0_scoped_true_lang = "";
var _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _sfc_main$e = {
  name: "Education",
  __ssrInlineRender: true,
  props: {
    education: Array
  },
  setup(__props) {
    const props = __props;
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      _push(`<article${ssrRenderAttrs(mergeProps({
        id: "skills",
        class: "cv-sidebar-article"
      }, _attrs))} data-v-12b6b610><h4 class="cv-sidebar-header" data-v-12b6b610>Education</h4><!--[-->`);
      ssrRenderList(props.education, (e) => {
        _push(ssrRenderComponent(_component_hgroup, null, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(`<h6 data-v-12b6b610${_scopeId}>${ssrInterpolate(e.institution)}</h6><p class="cv-sidebar-content" data-v-12b6b610${_scopeId}><span class="date" data-v-12b6b610${_scopeId}>${ssrInterpolate(`${e.startDate} - ${e.endDate}`)}</span><br data-v-12b6b610${_scopeId}><span data-v-12b6b610${_scopeId}>${ssrInterpolate(e.area)}</span></p><span data-v-12b6b610${_scopeId}></span>`);
            } else {
              return [
                createVNode("h6", null, toDisplayString(e.institution), 1),
                createVNode("p", { class: "cv-sidebar-content" }, [
                  createVNode("span", { class: "date" }, toDisplayString(`${e.startDate} - ${e.endDate}`), 1),
                  createVNode("br"),
                  createVNode("span", null, toDisplayString(e.area), 1)
                ]),
                createVNode("span")
              ];
            }
          }),
          _: 2
        }, _parent));
      });
      _push(`<!--]--></article>`);
    };
  }
};
const _sfc_setup$e = _sfc_main$e.setup;
_sfc_main$e.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/CV/Education.vue");
  return _sfc_setup$e ? _sfc_setup$e(props, ctx) : void 0;
};
var Education = /* @__PURE__ */ _export_sfc(_sfc_main$e, [["__scopeId", "data-v-12b6b610"]]);
var Home_vue_vue_type_style_index_0_scoped_true_lang = "";
const _sfc_main$d = {
  name: "Home",
  __ssrInlineRender: true,
  setup(__props) {
    const resume = useCvStore();
    const cv = resume.blankSlate;
    const relevantExp = resume.relevantExp;
    const showImage = resume.showImage;
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        id: "cv",
        class: "container"
      }, _attrs))} data-v-9ee104bc>`);
      _push(ssrRenderComponent(_sfc_main$k, {
        class: "side-content",
        profileInfo: [unref(cv).basics, unref(cv).skills, unref(relevantExp), unref(showImage)]
      }, null, _parent));
      _push(`<div id="body" class="grid" data-v-9ee104bc><div id="main" data-v-9ee104bc>`);
      _push(ssrRenderComponent(_sfc_main$j, {
        class: "side-content",
        workInfo: unref(cv).work
      }, null, _parent));
      _push(`</div><div id="sidebar" data-v-9ee104bc>`);
      _push(ssrRenderComponent(Education, {
        class: "side-content",
        education: unref(cv).education
      }, null, _parent));
      _push(ssrRenderComponent(_sfc_main$f, {
        class: "side-content",
        skills: unref(cv).skills
      }, null, _parent));
      _push(ssrRenderComponent(_sfc_main$i, {
        class: "side-content",
        certificates: unref(cv).certificates
      }, null, _parent));
      _push(ssrRenderComponent(_sfc_main$h, {
        class: "side-content",
        languages: unref(cv).languages
      }, null, _parent));
      _push(ssrRenderComponent(_sfc_main$g, {
        class: "side-content",
        interests: unref(cv).interests
      }, null, _parent));
      _push(`</div></div></div>`);
    };
  }
};
const _sfc_setup$d = _sfc_main$d.setup;
_sfc_main$d.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/Home.vue");
  return _sfc_setup$d ? _sfc_setup$d(props, ctx) : void 0;
};
var Home = /* @__PURE__ */ _export_sfc(_sfc_main$d, [["__scopeId", "data-v-9ee104bc"]]);
const useItemsStore = defineStore("items", {
  state: () => {
    return {
      searchInput: "",
      itemsLoading: false,
      addedItems: [],
      items: [
        {
          id: 1,
          employer: "loading...",
          role: "loading...",
          item: "loading...",
          created: "loading..."
        }
      ]
    };
  },
  getters: {
    headers: (state) => {
      return Object.keys(state.items[0]);
    },
    employers: (state) => {
      let employerList = state.items.map((a) => a.employer);
      return [...new Set(employerList)];
    },
    roles: (state) => {
      let employerList = state.items.map((a) => a.role);
      return [...new Set(employerList)];
    },
    searchItems(state) {
      let filteredItems = state.items;
      return filteredItems.filter((i) => i.item.toLowerCase().includes(state.searchInput) || i.role.toLowerCase().includes(state.searchInput) || i.employer.toLowerCase().includes(state.searchInput));
    },
    itemListLength: (state) => state.items.length
  },
  actions: {
    async getItems() {
      const { data, error } = await supabase.from("CV_Items").select();
      if (error)
        throw error;
      this.items = data;
    },
    addItemToBuilder(i) {
      this.addedItems.push(i);
    }
  }
});
const _sfc_main$c = {
  name: "Item",
  __ssrInlineRender: true,
  props: ["item"],
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      _push(`<article${ssrRenderAttrs(_attrs)}>`);
      _push(ssrRenderComponent(_component_hgroup, null, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<h4${_scopeId}>${ssrInterpolate(__props.item.employer)}</h4><h5${_scopeId}>${ssrInterpolate(__props.item.role)}</h5>`);
          } else {
            return [
              createVNode("h4", null, toDisplayString(__props.item.employer), 1),
              createVNode("h5", null, toDisplayString(__props.item.role), 1)
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`<p>${ssrInterpolate(__props.item.item)}</p><button href="#" role="button" class="secondary"> + </button></article>`);
    };
  }
};
const _sfc_setup$c = _sfc_main$c.setup;
_sfc_main$c.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/Item.vue");
  return _sfc_setup$c ? _sfc_setup$c(props, ctx) : void 0;
};
var Builder_vue_vue_type_style_index_0_lang = "";
const _sfc_main$b = {
  name: "Builder",
  __ssrInlineRender: true,
  props: {
    selectedItems: Array
  },
  setup(__props) {
    useItemsStore();
    const showBuilder = ref(true);
    let showConfirmClear = ref(false);
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      if (unref(showConfirmClear)) {
        _push(`<article${ssrRenderAttrs(_attrs)}><header><a href="#close" aria-label="Close" class="close"></a>`);
        _push(ssrRenderComponent(_component_hgroup, null, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(`<h2${_scopeId}>Are you sure you want to clear the item?</h2><p${_scopeId}>Confirm clearing.</p>`);
            } else {
              return [
                createVNode("h2", null, "Are you sure you want to clear the item?"),
                createVNode("p", null, "Confirm clearing.")
              ];
            }
          }),
          _: 1
        }, _parent));
        _push(`<div class=""><a role="button" class="secondary" href=""></a><a role="button" class="destructive" href=""></a></div></header></article>`);
      } else {
        _push(`<article${ssrRenderAttrs(mergeProps({ class: "card builder" }, _attrs))}><div class="grid"><div><a href="#" role="button" class="secondary">${ssrInterpolate(showBuilder.value ? "-" : "+")}</a></div><div><p>${ssrInterpolate(__props.selectedItems.length)}${ssrInterpolate(showBuilder.value ? " items" : "")}</p></div></div><div>`);
        if (showBuilder.value) {
          _push(`<div><header>`);
          _push(ssrRenderComponent(_component_hgroup, null, {
            default: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                _push2(`<h2${_scopeId}>Active List</h2><h4${_scopeId}>Included:</h4><p${_scopeId}>${ssrInterpolate(_ctx.collectedItems)}</p>`);
              } else {
                return [
                  createVNode("h2", null, "Active List"),
                  createVNode("h4", null, "Included:"),
                  createVNode("p", null, toDisplayString(_ctx.collectedItems), 1)
                ];
              }
            }),
            _: 1
          }, _parent));
          _push(`</header><figure><table><!--[-->`);
          ssrRenderList(__props.selectedItems, (item) => {
            _push(`<tr><td><b>${ssrInterpolate(item.employer)}</b></td><td>${ssrInterpolate(item.item)}</td></tr>`);
          });
          _push(`<!--]--></table></figure><footer><div class="grid"><button>Edit Resume</button></div><div><button class="contrast">Clear Resume</button></div></footer></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></article>`);
      }
    };
  }
};
const _sfc_setup$b = _sfc_main$b.setup;
_sfc_main$b.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/Builder.vue");
  return _sfc_setup$b ? _sfc_setup$b(props, ctx) : void 0;
};
const _sfc_main$a = {
  name: "List",
  __ssrInlineRender: true,
  setup(__props) {
    const items = useItemsStore();
    const showList = ref(true);
    return (_ctx, _push, _parent, _attrs) => {
      if (showList.value) {
        _push(`<div${ssrRenderAttrs(mergeProps({ class: "grid" }, _attrs))}><div><!--[-->`);
        ssrRenderList(unref(items).searchItems, (i) => {
          _push(ssrRenderComponent(_sfc_main$c, {
            key: i.id,
            item: i,
            onAddToResume: ($event) => unref(items).addItemToBuilder(i)
          }, null, _parent));
        });
        _push(`<!--]--></div></div>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
};
const _sfc_setup$a = _sfc_main$a.setup;
_sfc_main$a.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/List.vue");
  return _sfc_setup$a ? _sfc_setup$a(props, ctx) : void 0;
};
const _sfc_main$9 = {
  name: "TableBlock",
  __ssrInlineRender: true,
  setup(__props) {
    const items = useItemsStore();
    const showTable = ref(true);
    return (_ctx, _push, _parent, _attrs) => {
      if (showTable.value) {
        _push(`<table${ssrRenderAttrs(_attrs)}><thead><!--[-->`);
        ssrRenderList(unref(items).headers, (h) => {
          _push(`<th>${ssrInterpolate(h)}</th>`);
        });
        _push(`<!--]--></thead><tbody><!--[-->`);
        ssrRenderList(unref(items).searchItems, (item) => {
          _push(`<tr><!--[-->`);
          ssrRenderList(item, (i) => {
            _push(`<td>${ssrInterpolate(i)}</td>`);
          });
          _push(`<!--]--><td><button role="button" class="secondary"><span>+</span></button></td></tr>`);
        });
        _push(`<!--]--></tbody></table>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
};
const _sfc_setup$9 = _sfc_main$9.setup;
_sfc_main$9.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/TableBlock.vue");
  return _sfc_setup$9 ? _sfc_setup$9(props, ctx) : void 0;
};
const useSettingStore = defineStore("settings", {
  state: () => ({
    showCreateItemModal: false,
    showListNotTable: true,
    showFilter: false
  }),
  actions: {
    toggleView: (state) => {
      globalThis.showListNotTable = !globalThis.showListNotTable;
    }
  }
});
const _sfc_main$8 = {
  name: "SearchBar",
  __ssrInlineRender: true,
  setup(__props) {
    const items = useItemsStore();
    useSettingStore();
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(_attrs)}><nav><ul></ul><ul><li><a>List</a></li><li><a>Table</a></li></ul></nav><input placeholder="Search" type="search" name="search" id=""${ssrRenderAttr("value", unref(items).searchInput)}></div>`);
    };
  }
};
const _sfc_setup$8 = _sfc_main$8.setup;
_sfc_main$8.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/SearchBar.vue");
  return _sfc_setup$8 ? _sfc_setup$8(props, ctx) : void 0;
};
const _sfc_main$7 = {
  name: "Filter",
  __ssrInlineRender: true,
  setup(__props) {
    const items = useItemsStore();
    const settings = useSettingStore();
    return (_ctx, _push, _parent, _attrs) => {
      if (unref(settings).showFilter) {
        _push(`<select${ssrRenderAttrs(mergeProps({ role: "listbox" }, _attrs))}><option value="" disabled selected>Select</option><option value="" selected>None</option><!--[-->`);
        ssrRenderList(unref(items).employers, (e) => {
          _push(`<option>${ssrInterpolate(e)}</option>`);
        });
        _push(`<!--]--></select>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
};
const _sfc_setup$7 = _sfc_main$7.setup;
_sfc_main$7.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/Filter.vue");
  return _sfc_setup$7 ? _sfc_setup$7(props, ctx) : void 0;
};
const _sfc_main$6 = {
  name: "CreateItem",
  __ssrInlineRender: true,
  setup(__props) {
    const settings = useSettingStore();
    const items = useItemsStore();
    ref(items.items);
    let listLength = items.itemListLength;
    let loading = ref(false);
    let submitted = ref(false);
    const displayedDate = ref("");
    const newItem = reactive({
      id: items.itemListLength + 1,
      employer: "",
      role: "",
      item: "",
      created: displayedDate.value
    });
    function createDate() {
      let today = dayjs().format();
      let createTodaysDisplayedDate = dayjs(today).format("YYYY-MM-DD");
      let createItemDate = dayjs(today).format("DD-MM-YYYY");
      displayedDate.value = createTodaysDisplayedDate;
      newItem.created = createItemDate;
    }
    function createID() {
      return listLength + 1;
    }
    onMounted(() => {
      createDate();
    });
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      _push(`<dialog${ssrRenderAttrs(mergeProps({
        open: unref(settings).showCreateItemModal
      }, _attrs))}><article><header><a href="#close" aria-label="Close" class="close"></a>`);
      _push(ssrRenderComponent(_component_hgroup, null, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<h2${_scopeId}>Create Item</h2><p${_scopeId}>Create a new item to add to CV <br${_scopeId}></p>`);
          } else {
            return [
              createVNode("h2", null, "Create Item"),
              createVNode("p", null, [
                createTextVNode("Create a new item to add to CV "),
                createVNode("br")
              ])
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</header><div class="card"><summary><h6>id:</h6><input type="number" name="" id=""${ssrRenderAttr("value", createID())} disabled></summary><input type="text" name="employer" id="employers" list="employer-list" placeholder="Enter your employer"${ssrRenderAttr("value", newItem.employer)}><datalist id="employer-list"><!--[-->`);
      ssrRenderList(unref(items).employers, (e) => {
        _push(`<option${ssrRenderAttr("value", e)}>${ssrInterpolate(e)}</option>`);
      });
      _push(`<!--]--></datalist><input type="text" name="role" id="roles" list="role-list" placeholder="Enter your role"${ssrRenderAttr("value", newItem.role)}><datalist id="role-list"><!--[-->`);
      ssrRenderList(unref(items).roles, (r) => {
        _push(`<option${ssrRenderAttr("value", r)}>${ssrInterpolate(r)}</option>`);
      });
      _push(`<!--]--></datalist><input type="text" name="item" id="item" placeholder="Enter your resume item"${ssrRenderAttr("value", newItem.item)}> hello: ${ssrInterpolate(newItem.createdDate)} <input type="date" name="create-date" id="createDate"${ssrRenderAttr("value", displayedDate.value)} disabled></div><footer><div><a href="#" role="button" class="${ssrRenderClass(!unref(submitted) ? "secondary" : "contrast")}" data-target="modal-example">${ssrInterpolate(!unref(submitted) ? "Cancel" : "Close")}</a>`);
      if (!unref(submitted)) {
        _push(`<a href="#confirm" role="button" data-target="modal-example"${ssrRenderAttr("aria-busy", unref(loading) ? "true" : "false")}> Confirm </a>`);
      } else {
        _push(`<a href="#" class="secondary" role="button">\u2714</a>`);
      }
      _push(`</div></footer></article></dialog>`);
    };
  }
};
const _sfc_setup$6 = _sfc_main$6.setup;
_sfc_main$6.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/CreateItem.vue");
  return _sfc_setup$6 ? _sfc_setup$6(props, ctx) : void 0;
};
const _sfc_main$5 = {
  name: "CVBuilder",
  __ssrInlineRender: true,
  setup(__props) {
    const settings = useSettingStore();
    const store = useItemsStore();
    store.getItems();
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<main${ssrRenderAttrs(_attrs)}>`);
      _push(ssrRenderComponent(_sfc_main$6, null, null, _parent));
      _push(ssrRenderComponent(_sfc_main$8, null, null, _parent));
      _push(ssrRenderComponent(_sfc_main$7, null, null, _parent));
      _push(ssrRenderComponent(_sfc_main$b, {
        selectedItems: unref(store).addedItems
      }, null, _parent));
      if (unref(settings).showListNotTable) {
        _push(ssrRenderComponent(_sfc_main$a, {
          listItems: unref(store).items
        }, null, _parent));
      } else {
        _push(ssrRenderComponent(_sfc_main$9, {
          items: unref(store).items
        }, null, _parent));
      }
      _push(`</main>`);
    };
  }
};
const _sfc_setup$5 = _sfc_main$5.setup;
_sfc_main$5.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/CVBuilder.vue");
  return _sfc_setup$5 ? _sfc_setup$5(props, ctx) : void 0;
};
const _sfc_main$4 = {
  name: "CVList",
  __ssrInlineRender: true,
  setup(__props) {
    const { cvs, CVsLoading } = storeToRefs(useCvStore());
    console.log("xvs? ", cvs);
    const { getCVs } = useCvStore();
    getCVs();
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<div${ssrRenderAttrs(_attrs)}><!--[-->`);
      ssrRenderList(unref(cvs), (cv) => {
        _push(ssrRenderComponent(_component_router_link, {
          to: `/cv/${cv.resume_name}`
        }, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(`<article${ssrRenderAttr("aria-busy", unref(CVsLoading))}${_scopeId}>${ssrInterpolate(cv.resume_name)}</article>`);
            } else {
              return [
                createVNode("article", { "aria-busy": unref(CVsLoading) }, toDisplayString(cv.resume_name), 9, ["aria-busy"])
              ];
            }
          }),
          _: 2
        }, _parent));
      });
      _push(`<!--]--></div>`);
    };
  }
};
const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/CVList.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
var CVCustom_vue_vue_type_style_index_0_scoped_true_lang = "";
const _sfc_main$3 = {
  name: "CVCustom",
  __ssrInlineRender: true,
  setup(__props) {
    const { activeCV, cvs } = storeToRefs(useCvStore());
    const { getCVs } = useCvStore();
    getCVs();
    const route = useRoute();
    console.log("cvs in the page: ", cvs);
    console.log("paraps: ", route.params);
    let resume = route.params.resume_name;
    const cv = computed(() => cvs.find((x) => x.id === parseInt(1)));
    const shit = ref({
      thing: {}
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<!--[--> route: ${ssrInterpolate(unref(resume))} <br data-v-4da01676><br data-v-4da01676> load: ${ssrInterpolate(unref(cv))} <br data-v-4da01676><br data-v-4da01676> ${ssrInterpolate(shit.value.thing)} ${ssrInterpolate(unref(cvs)[0])}<!--]-->`);
    };
  }
};
const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/CVCustom.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
var CVCustom = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-4da01676"]]);
const _sfc_main$2 = {};
const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/NotFound.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const routes$1 = [
  {
    path: "/",
    name: "Home",
    component: Home
  },
  {
    path: "/cv",
    name: "List",
    component: _sfc_main$4
  },
  {
    path: "/cv/:resume_name",
    name: "Resume",
    component: CVCustom
  },
  {
    path: "/build",
    name: "CV Builder",
    component: _sfc_main$5
  }
];
const router = createRouter({
  history: createWebHistory(),
  routes: routes$1
});
var AppHeader_vue_vue_type_style_index_0_lang = "";
const _sfc_main$1 = {
  name: "AppHeader",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    useSettingStore();
    return (_ctx, _push, _parent, _attrs) => {
      const _component_hgroup = resolveComponent("hgroup");
      _push(`<!--[--><header id="site-header"><nav><ul><li><a href="https://nicbenson.com.au">\u2B05 Back to NicBenson.com.au</a></li></ul><ul><li></li><li></li></ul></nav><hr>`);
      _push(ssrRenderComponent(_component_hgroup, null, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<h1${_scopeId}>${ssrInterpolate(unref(route).name)}</h1><h3${_scopeId}>${ssrInterpolate(unref(route).path == "/build" ? "Create a custom resume from your previously saved items" : "")}</h3>`);
          } else {
            return [
              createVNode("h1", null, toDisplayString(unref(route).name), 1),
              createVNode("h3", null, toDisplayString(unref(route).path == "/build" ? "Create a custom resume from your previously saved items" : ""), 1)
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</header><header id="print-header"><h2>Nicholas Benson CV</h2></header><!--]-->`);
    };
  }
};
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/AppHeader.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
var App_vue_vue_type_style_index_0_lang = "";
const _sfc_main = {
  name: "App",
  __ssrInlineRender: true,
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      const _component_Router_View = resolveComponent("Router-View");
      _push(`<!--[--><div class="container">`);
      _push(ssrRenderComponent(_sfc_main$1, null, null, _parent));
      _push(`</div><main class="container">`);
      _push(ssrRenderComponent(_component_Router_View, null, null, _parent));
      _push(`</main><!--]-->`);
    };
  }
};
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/App.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
createPinia();
const createApp = ViteSSG(_sfc_main, { routes }, { app, router, routes, isClient, initialState });
export { createApp };
