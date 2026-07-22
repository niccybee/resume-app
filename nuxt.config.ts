import { fileURLToPath } from "node:url";

const publicSupabaseUrl =
  process.env.NUXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";
const publicSupabasePublishableKey =
  process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

export default defineNuxtConfig({
  compatibilityDate: "2026-07-21",
  experimental: {
    asyncContext: true,
  },
  modules: ["@pinia/nuxt", "@nuxt/ui", "@nuxtjs/mcp-toolkit"],
  css: [
    fileURLToPath(
      new URL("./app/assets/css/main.css", import.meta.url),
    ),
  ],
  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    publicationSupabaseUrl:
      process.env.SUPABASE_URL ||
      publicSupabaseUrl,
    publicationSupabasePublishableKey:
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      publicSupabasePublishableKey,
    mcpSupabaseUrl:
      process.env.SUPABASE_URL ||
      publicSupabaseUrl,
    mcpSupabasePublishableKey:
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      publicSupabasePublishableKey,
    mcpAllowedUserIds: process.env.NUXT_MCP_ALLOWED_USER_IDS || "",
    mcpGatewayKey: process.env.NUXT_MCP_GATEWAY_KEY || "",
    mcpAuthenticationRateLimit: Number(process.env.NUXT_MCP_AUTHENTICATION_RATE_LIMIT) || 120,
    public: {
      supabaseUrl: publicSupabaseUrl,
      supabasePublishableKey: publicSupabasePublishableKey,
    },
  },
  routeRules: {
    "/app/**": { ssr: false },
    "/login": { ssr: false },
    "/oauth/**": { ssr: false },
  },
  mcp: {
    name: "Resume Studio",
    version: "1.0.0",
    route: "/mcp",
    browserRedirect: "/",
    description: "Manage the signed-in user's Resume Studio CVs through MCP.",
    instructions: "Read current CV state before proposing changes. Mutating tools require explicit apply confirmation.",
  },
  nitro: {
    // Keep the server dependency graph in one module format. Externalizing it
    // creates a Vue Router devtools/perfect-debounce CJS/ESM startup cycle.
    noExternals: true,
    serverAssets: [
      {
        baseName: "static-cvs",
        dir: fileURLToPath(
          new URL("./.generated/public/cv", import.meta.url),
        ),
      },
    ],
  },
  vite: {
    vue: {
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === "hgroup",
        },
      },
    },
  },
});
