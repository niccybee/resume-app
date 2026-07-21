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
  modules: ["@pinia/nuxt"],
  css: [
    fileURLToPath(
      new URL("./src/styles/design-system.css", import.meta.url),
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
    public: {
      supabaseUrl: publicSupabaseUrl,
      supabasePublishableKey: publicSupabasePublishableKey,
    },
  },
  routeRules: {
    "/app/**": { ssr: false },
    "/login": { ssr: false },
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
