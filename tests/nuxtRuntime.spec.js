import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
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
const withdrawnCvFixture = resolve(staticCvStage, "cv/t06-withdrawn");
const failedCvFixture = resolve(staticCvStage, "cv/t06-verification-fails");

const publicationServer = createServer(async (request, response) => {
  if (request.url === "/auth/v1/user") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({
      id: "mcp-owner",
      email: "mcp-owner@example.test",
      aud: "authenticated",
      role: "authenticated",
    }));
    return;
  }
  if (request.url === "/.well-known/oauth-authorization-server/auth/v1") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({
      issuer: `${publicationServerUrl}/auth/v1`,
      authorization_endpoint: `${publicationServerUrl}/auth/v1/oauth/authorize`,
      token_endpoint: `${publicationServerUrl}/auth/v1/oauth/token`,
      registration_endpoint: `${publicationServerUrl}/auth/v1/oauth/clients/register`,
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    }));
    return;
  }
  if (request.url === "/auth/v1/.well-known/openid-configuration") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({
      issuer: `${publicationServerUrl}/auth/v1`,
      authorization_endpoint: `${publicationServerUrl}/auth/v1/oauth/authorize`,
      token_endpoint: `${publicationServerUrl}/auth/v1/oauth/token`,
      jwks_uri: `${publicationServerUrl}/auth/v1/.well-known/jwks.json`,
    }));
    return;
  }
  if (request.url !== "/rest/v1/rpc/get_published_cv") {
    response.writeHead(404).end();
    return;
  }

  let body = "";
  for await (const chunk of request) body += chunk;
  const slug = JSON.parse(body).p_slug;
  if (slug === "t06-verification-fails") {
    response.writeHead(500).end("verification unavailable");
    return;
  }

  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(slug === "t01-static-smoke"
    ? { slug, status: "published", revisionId: "revision-runtime" }
    : null));
});
const startPublicationCheckServer = (port = 0) => new Promise((resolveListen) => {
  publicationServer.listen(port, "127.0.0.1", resolveListen);
});
const stopPublicationCheckServer = () => new Promise((resolveClose, rejectClose) => {
  publicationServer.close((error) => {
    if (error) rejectClose(error);
    else resolveClose();
  });
});

await startPublicationCheckServer();
const publicationAddress = publicationServer.address();
const publicationServerUrl = `http://127.0.0.1:${publicationAddress.port}`;
const encodeJwtPart = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const mcpAccessToken = `${encodeJwtPart({ alg: "RS256", typ: "JWT" })}.${encodeJwtPart({
  sub: "mcp-owner",
  role: "authenticated",
  aud: "authenticated",
  iss: `${publicationServerUrl}/auth/v1`,
  client_id: "chat-client-runtime",
  exp: 1999999999,
})}.runtime-signature`;
await stopPublicationCheckServer();

await Promise.all([
  staticCvFixture,
  withdrawnCvFixture,
  failedCvFixture,
].map((fixture) => mkdir(fixture, { recursive: true })));
await Promise.all([
  writeFile(
    resolve(staticCvFixture, "index.html"),
    '<meta name="robots" content="noindex, nofollow, noarchive"><meta name="cv-revision" content="revision-runtime"><p data-static-cv-runtime="true">Static CV from Nuxt output</p>',
  ),
  writeFile(resolve(withdrawnCvFixture, "index.html"), "stale withdrawn CV"),
  writeFile(resolve(failedCvFixture, "index.html"), "unverified CV"),
]);

afterAll(
  async () => {
    await rm(staticCvStage, { recursive: true, force: true });
    if (publicationServer.listening) {
      await stopPublicationCheckServer();
    }
  },
  60_000,
);

describe("Nuxt runtime", async () => {
  await setup({
    setupTimeout: 240_000,
    teardownTimeout: 60_000,
    rootDir: projectRoot,
    build: true,
    browser: true,
    server: true,
    nuxtConfig: {
      runtimeConfig: {
        supabaseServiceRoleKey: serverOnlySecret,
        publicationSupabaseUrl: publicationServerUrl,
        publicationSupabasePublishableKey: "t06-publication-key",
        mcpSupabaseUrl: publicationServerUrl,
        mcpSupabasePublishableKey: "t16-mcp-publishable-key",
        public: {
          supabaseUrl: "https://t02-test.supabase.co",
          supabasePublishableKey: "t02-test-publishable-key",
        },
      },
      nitro: {
        serverAssets: [{
          baseName: "static-cvs",
          dir: resolve(staticCvStage, "cv"),
        }],
      },
    },
  });

  await startPublicationCheckServer(publicationAddress.port);

  it("serves a representative route natively from Nuxt 4", async () => {
    const html = await $fetch("/runtime");

    expect(html).toContain('data-native-nuxt-runtime="true"');
    expect(html).toContain("Resume Studio runs on Nuxt 4");
  });

  it("serves the public homepage natively from Nuxt", async () => {
    const html = await $fetch("/");

    expect(html).toContain("Write once.");
    expect(html).toContain("Shape every CV.");
  });

  it("serves staged static CV snapshots from the production server", async () => {
    const response = await fetch(url("/cv/t01-static-smoke"));
    const html = await response.text();
    const trailingSlashHtml = await $fetch("/cv/t01-static-smoke/");

    expect(html).toContain('data-static-cv-runtime="true"');
    expect(trailingSlashHtml).toContain('data-static-cv-runtime="true"');
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("blocks stale and unverifiable static CV snapshots inside Nuxt", async () => {
    await expect($fetch("/cv/t06-withdrawn")).rejects.toMatchObject({
      statusCode: 404,
      data: "CV is not published.",
    });
    await expect($fetch("/cv/t06-verification-fails")).rejects.toMatchObject({
      statusCode: 503,
      data: "CV publication status is temporarily unavailable.",
    });
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

  it("serves the authenticated OpenRouter boundary from Nuxt", async () => {
    await expect($fetch("/api/openrouter", {
      method: "POST",
      body: { action: "status" },
    })).rejects.toMatchObject({
      statusCode: 401,
      data: {
        code: "authentication-required",
        error: "Sign in to manage OpenRouter.",
      },
    });
  });

  it("publishes OAuth discovery and protects the MCP transport", async () => {
    const [protectedResource, authorizationServer, openId] = await Promise.all([
      $fetch("/.well-known/oauth-protected-resource/mcp"),
      $fetch("/.well-known/oauth-authorization-server"),
      $fetch("/.well-known/openid-configuration"),
    ]);

    expect(protectedResource).toMatchObject({
      resource: `${url("/").replace(/\/$/, "")}/mcp`,
      authorization_servers: [`${publicationServerUrl}/auth/v1`],
    });
    expect(authorizationServer).toMatchObject({
      registration_endpoint: `${publicationServerUrl}/auth/v1/oauth/clients/register`,
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    });
    expect(openId.issuer).toBe(`${publicationServerUrl}/auth/v1`);

    const rejected = await fetch(url("/mcp"), {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("www-authenticate")).toContain(
      '/.well-known/oauth-protected-resource/mcp',
    );

    const accepted = await fetch(url("/mcp"), {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${mcpAccessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "Runtime Chat", version: "1.0.0" },
        },
      }),
    });
    const acceptedBody = await accepted.text();
    expect(accepted.status, acceptedBody).toBe(200);
    expect(acceptedBody).toContain("Resume Studio");

    const identity = await fetch(url("/mcp"), {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${mcpAccessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_connection_identity", arguments: {} },
      }),
    });
    const identityBody = await identity.text();
    expect(identity.status, identityBody).toBe(200);
    expect(identityBody).toContain("mcp-owner");
    expect(identityBody).toContain("chat-client-runtime");
  });

  it("returns a signed-out user to the exact OAuth consent request", async () => {
    const context = await (await getBrowser()).newContext();
    const page = await context.newPage();

    try {
      await page.goto(url("/oauth/consent?authorization_id=authorization-1"));
      await page.waitForURL("**/login?redirect=**");
      expect(new URL(page.url()).searchParams.get("redirect")).toBe(
        "/oauth/consent?authorization_id=authorization-1",
      );
    } finally {
      await context.close();
    }
  }, 20_000);

  it("shows client details and submits explicit OAuth consent", async () => {
    const context = await (await getBrowser()).newContext();
    await context.addInitScript(
      ({ key, session }) => localStorage.setItem(key, session),
      { key: browserAuthStorageKey, session: browserSession },
    );
    await context.route("**/auth/v1/oauth/authorizations/authorization-1", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authorization_id: "authorization-1",
        redirect_uri: "https://chat.example/callback",
        client: {
          id: "chat-client-runtime",
          name: "Runtime Chat Client",
          uri: "https://chat.example",
          logo_uri: "",
        },
        user: { id: "t02-browser-owner", email: "owner@example.test" },
        scope: "openid email profile",
      }),
    }));
    await context.route("**/auth/v1/oauth/authorizations/authorization-1/consent", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ action: "approve" });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ redirect_url: url("/runtime?approved=1") }),
      });
    });
    const page = await context.newPage();

    try {
      await page.goto(url("/oauth/consent?authorization_id=authorization-1"));
      await page.getByRole("heading", { name: "Runtime Chat Client" }).waitFor();
      expect(await page.getByText("openid, email, profile").isVisible()).toBe(true);
      await page.getByRole("button", { name: "Approve" }).click();
      await page.waitForURL("**/runtime?approved=1");
    } finally {
      await context.close();
    }
  }, 20_000);

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
    await context.route("**/rest/v1/**", (route) => {
      const requestUrl = new URL(route.request().url());
      const resource = requestUrl.pathname.split("/").at(-1);
      let body = [];

      if (resource === "cv_documents" && requestUrl.searchParams.get("id") === "eq.cv-native") {
        body = {
          id: "cv-native",
          owner_id: "t02-browser-owner",
          name: "Native private CV",
          status: "draft",
          theme_id: null,
          profile: {},
          summary: null,
          summary_provenance: null,
          slug: null,
          published_at: null,
        };
      } else if (resource === "cv_revisions") {
        body = [{
          id: "revision-native", cv_id: "cv-native", revision_number: 1, base_revision_id: null,
          theme_id: "editorial", profile: { basics: { name: "Nic", label: "Product Manager" } },
          summary: "A saved private CV rendered through Nuxt.", summary_provenance: null,
          created_at: "2026-07-21T00:00:00.000Z",
        }];
      } else if (resource === "get_cv_revision_snapshot") {
        body = {
          id: "revision-native", cvId: "cv-native", number: 1, baseRevisionId: null,
          themeId: "editorial", profile: { basics: { name: "Nic", label: "Product Manager" } },
          summary: "A saved private CV rendered through Nuxt.", summaryProvenance: null,
          selections: [{
            blockId: "block-native", versionId: "version-native", section: "experience", order: 0,
            content: { text: "Shipped a saved composition through native Nuxt pages." },
            block: { title: "Native product launch", kind: "experience" },
          }],
        };
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
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

      await page.getByRole("link", { name: "Saved CVs", exact: true }).click();
      await page.waitForURL("**/app/cvs");
      await page.getByRole("heading", { name: "No saved CVs yet" }).waitFor();
      await page.getByRole("button", { name: "Create the first CV" }).click();
      await page.waitForURL("**/app/cvs/new");
      const cvName = page.getByLabel("CV name");
      await cvName.waitFor();
      expect(await cvName.isVisible()).toBe(true);
      const cvBlockLibrary = page.getByRole("heading", { name: "CV Block Library" });
      await cvBlockLibrary.waitFor();
      expect(await cvBlockLibrary.isVisible()).toBe(true);

      await page.goto(url("/app/cvs/cv-native/preview"));
      await page.getByText("A saved private CV rendered through Nuxt.").waitFor();
      expect(await page.getByText("Shipped a saved composition through native Nuxt pages.").isVisible()).toBe(true);
      expect(await page.getByRole("link", { name: "Back to editor" }).isVisible()).toBe(true);

      await page.getByRole("link", { name: "Blocks", exact: true }).click();
      await page.waitForURL("**/app/blocks");
      const blockSearch = page.getByRole("searchbox", { name: "Search CV Blocks, employers, roles…" });
      await blockSearch.waitFor();
      expect(await blockSearch.isVisible()).toBe(true);

      await page.getByRole("link", { name: "AI settings", exact: true }).click();
      await page.waitForURL("**/app/settings/ai");
      await page.getByRole("heading", { name: "AI settings" }).waitFor();
      const openRouterStatus = page.getByText("OpenRouter is not connected");
      await openRouterStatus.waitFor();
      expect(await openRouterStatus.isVisible()).toBe(true);

      await page.getByRole("button", { name: "Sign out" }).click();
      await page.waitForURL("**/login");
      const loginHeading = page.getByRole("heading", { name: "Sign in to manage CVs" });
      await loginHeading.waitFor();
      expect(await loginHeading.isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 40_000);
});
