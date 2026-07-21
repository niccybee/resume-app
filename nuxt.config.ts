import { fileURLToPath } from "node:url";

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
    public: {
      supabaseUrl:
        process.env.NUXT_PUBLIC_SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        "",
      supabasePublishableKey:
        process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        "",
    },
  },
  routeRules: {
    "/app/**": { ssr: false },
    "/cv/**": { ssr: false },
    "/login": { ssr: false },
  },
  nitro: {
    // Keep the server dependency graph in one module format. Externalizing it
    // creates a Vue Router devtools/perfect-debounce CJS/ESM startup cycle.
    noExternals: true,
    publicAssets: [
      {
        dir: fileURLToPath(
          new URL("./.generated/public", import.meta.url),
        ),
        baseURL: "/",
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
