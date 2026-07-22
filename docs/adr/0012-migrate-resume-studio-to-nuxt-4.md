# Migrate Resume Studio to Nuxt 4

Resume Studio will migrate from its Vue/Vite application shell to Nuxt 4 rather than introducing a separate Nuxt MCP service. The workspace UI, Supabase OAuth consent flow, MCP endpoint, domain services, and publication runtime will share one application and deployment. We accept the larger initial migration and the need to rework static CV publication in exchange for avoiding duplicated authentication, configuration, domain packaging, deployments, and cross-service transaction boundaries.
