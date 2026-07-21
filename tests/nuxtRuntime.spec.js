import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  $fetch,
  getBrowser,
  setup,
  url,
  useTestContext,
} from "@nuxt/test-utils/e2e";
import { afterAll, describe, expect, it } from "vitest";

const serverOnlySecret = "server-only-t01-test-secret";
const browserAuthStorageKey = "sb-t02-test-auth-token";
const browserSession = JSON.stringify({
  access_token: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ0MDItYnJvd3Nlci1vd25lciIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6MTk5OTk5OTk5OX0.",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 1999999999,
  refresh_token: "t02-browser-refresh",
  user: {
    id: "t02-browser-owner",
    aud: "authenticated",
    role: "authenticated",
    email: "owner@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
  },
});
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
    browser: true,
    server: true,
    nuxtConfig: {
      runtimeConfig: {
        supabaseServiceRoleKey: serverOnlySecret,
        public: {
          supabaseUrl: "https://t02-test.supabase.co",
          supabasePublishableKey: "t02-test-publishable-key",
        },
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

  it("redirects a signed-out browser without rendering the protected shell", async () => {
    const context = await (await getBrowser()).newContext();
    const page = await context.newPage();

    try {
      await page.goto(url("/app/settings/ai?tab=model"));
      await page.waitForURL("**/login?redirect=**");

      expect(new URL(page.url()).searchParams.get("redirect")).toBe(
        "/app/settings/ai?tab=model",
      );
      expect(await page.getByRole("heading", { name: "Sign in to manage CVs" }).isVisible()).toBe(true);
      expect(await page.locator("[data-workspace-navigation]").count()).toBe(0);
    } finally {
      await context.close();
    }
  }, 20_000);

  it("restores an authenticated browser into native workspace journeys", async () => {
    const context = await (await getBrowser()).newContext();
    await context.addInitScript(
      ({ key, session }) => localStorage.setItem(key, session),
      { key: browserAuthStorageKey, session: browserSession },
    );
    await context.route("**/auth/v1/logout**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    }));
    const page = await context.newPage();

    try {
      await page.goto(url("/login?redirect=/app/missing"));
      await page.waitForURL("**/app/missing");
      const notFoundMessage = page.getByText("The requested workspace page does not exist.");
      await notFoundMessage.waitFor();
      expect(await notFoundMessage.isVisible()).toBe(true);
      expect(await page.getByText("Resume Studio", { exact: true }).isVisible()).toBe(true);

      await page.reload();
      const workspaceNavigation = page.locator("[data-workspace-navigation]");
      await workspaceNavigation.waitFor();
      expect(await workspaceNavigation.isVisible()).toBe(true);
      expect(page.url()).toContain("/app/missing");

      await page.getByRole("link", { name: "Blocks", exact: true }).click();
      await page.waitForURL("**/app/blocks");
      const blockSearch = page.getByRole("searchbox", { name: "Search blocks, companies, roles…" });
      await blockSearch.waitFor();
      expect(await blockSearch.isVisible()).toBe(true);

      await page.getByRole("button", { name: "Sign out" }).click();
      await page.waitForURL("**/login");
      const loginHeading = page.getByRole("heading", { name: "Sign in to manage CVs" });
      await loginHeading.waitFor();
      expect(await loginHeading.isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 20_000);
});
