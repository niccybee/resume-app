import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { $fetch, setup, useTestContext } from "@nuxt/test-utils/e2e";
import { afterAll, describe, expect, it } from "vitest";

const serverOnlySecret = "server-only-t01-test-secret";
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const staticCvStage = await mkdtemp(join(tmpdir(), "resume-nuxt-static-cv-"));
const staticCvFixture = resolve(staticCvStage, "cv/t01-static-smoke");

await mkdir(staticCvFixture, { recursive: true });
await writeFile(
  resolve(staticCvFixture, "index.html"),
  '<p data-static-cv-runtime="true">Static CV from Nuxt output</p>',
);

afterAll(() => rm(staticCvStage, { recursive: true, force: true }));

describe("Nuxt runtime", async () => {
  await setup({
    rootDir: projectRoot,
    build: true,
    server: true,
    nuxtConfig: {
      runtimeConfig: {
        supabaseServiceRoleKey: serverOnlySecret,
      },
      nitro: {
        publicAssets: [{ dir: staticCvStage, baseURL: "/" }],
      },
    },
  });

  it("serves a representative route natively from Nuxt 4", async () => {
    const html = await $fetch("/runtime");

    expect(html).toContain('data-native-nuxt-runtime="true"');
    expect(html).toContain("Resume Studio runs on Nuxt 4");
  });

  it("serves an unmigrated Vue screen through the Nuxt compatibility shell", async () => {
    const html = await $fetch("/");

    expect(html).toContain("Write once.");
    expect(html).toContain("Shape every CV.");
  });

  it("serves staged static CV snapshots from the production server", async () => {
    const html = await $fetch("/cv/t01-static-smoke/");

    expect(html).toContain('data-static-cv-runtime="true"');
  });

  it("keeps server-only credentials out of public build artifacts", async () => {
    const publicDir = resolve(
      useTestContext().nuxt.options.nitro.output.dir,
      "public",
    );
    const files = await readdir(publicDir, { recursive: true });
    const publicOutput = await Promise.all(
      files.map((file) => readFile(resolve(publicDir, file)).catch(() => Buffer.from(""))),
    );

    expect(Buffer.concat(publicOutput).includes(serverOnlySecret)).toBe(false);
  });
});
