import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const fromRoot = (path) => resolve(root, path);

describe("completed Nuxt migration", () => {
  it("owns every supported route through native Nuxt files", async () => {
    const nativeRoutes = [
      "app/pages/index.vue",
      "app/pages/login.vue",
      "app/pages/[...path].vue",
      "app/pages/build.vue",
      "app/pages/cv/index.vue",
      "app/pages/app/blocks.vue",
      "app/pages/app/cvs/index.vue",
      "app/pages/app/cvs/new.vue",
      "app/pages/app/cvs/[cvId]/index.vue",
      "app/pages/app/cvs/[cvId]/preview.vue",
      "app/pages/app/settings/ai.vue",
      "server/routes/cv/[slug].get.js",
    ];

    await expect(Promise.all(nativeRoutes.map((path) => access(fromRoot(path))))).resolves.toBeDefined();
  });

  it("removes the Vue Router compatibility bootstrap and Vite-only entrypoints", async () => {
    const retiredPaths = [
      "app/router.options.js",
      "app/plugins/legacy-auth.client.js",
      "src/App.vue",
      "src/main.js",
      "src/router/index.js",
      "src/router/routes.js",
      "vite.config.js",
      "index.html",
    ];

    const results = await Promise.all(retiredPaths.map((path) =>
      access(fromRoot(path)).then(() => true, () => false)));
    expect(results).toEqual(retiredPaths.map(() => false));
  });

  it("uses only Nuxt build tooling and runtime environment names", async () => {
    const packageJson = JSON.parse(await readFile(fromRoot("package.json"), "utf8"));
    const config = await readFile(fromRoot("nuxt.config.ts"), "utf8");
    const staticBuild = await readFile(fromRoot("scripts/static-cvs.mjs"), "utf8");

    expect(packageJson.devDependencies).not.toHaveProperty("vite");
    expect(packageJson.devDependencies).toHaveProperty("@vitejs/plugin-vue");
    expect(packageJson.scripts).toMatchObject({
      dev: expect.stringContaining("nuxt dev"),
      build: expect.stringContaining("nuxt build"),
      preview: expect.stringContaining("nuxt preview"),
    });
    expect(`${config}\n${staticBuild}`).not.toContain("VITE_");
  });

  it("publishes the Netlify-recognized Nuxt output without an external gate", async () => {
    const netlify = await readFile(fromRoot("netlify.toml"), "utf8");

    expect(netlify).toContain('publish = "dist"');
    expect(netlify).toMatch(/\[build\.environment\][\s\S]*STATIC_CV_GENERATION_REQUIRED = "true"/);
    expect(netlify).toMatch(/\[context\.deploy-preview\.environment\][\s\S]*STATIC_CV_GENERATION_REQUIRED = "false"/);
    expect(netlify).not.toContain("edge_functions");
    expect(netlify).not.toContain("cv-publication-gate");
  });
});
