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
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

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
const mcpEditingSessionRow = {
  id: "session-mcp",
  cv_id: "cv-mcp",
  owner_id: "mcp-owner",
  base_revision_id: "revision-mcp",
  status: "open",
  optimistic_version: 2,
  working_name: "Product Manager at Google",
  working_theme_id: "editorial",
  working_profile: { basics: { name: "MCP Owner" } },
  working_summary: "A working summary.",
  working_summary_provenance: null,
  finished_revision_id: null,
  selections: [],
  created_at: "2026-07-21T01:00:00.000Z",
  updated_at: "2026-07-21T02:00:00.000Z",
  finished_at: null,
};

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
  const requestUrl = new URL(request.url, "http://resume-studio.test");
  if (requestUrl.pathname === "/rest/v1/cv_documents") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify([{
      id: "cv-mcp",
      owner_id: "mcp-owner",
      name: "Product Manager at Google",
      slug: "product-manager-google",
      status: "published",
      published_at: "2026-07-21T00:00:00.000Z",
      published_revision_id: "revision-mcp",
    }]));
    return;
  }
  if (requestUrl.pathname === "/rest/v1/cv_revisions") {
    response.setHeader("Content-Type", "application/json");
    const rows = requestUrl.searchParams.get("cv_id") === "eq.cv-another-user" ? [] : [{
      id: "revision-mcp",
      cv_id: "cv-mcp",
      owner_id: "mcp-owner",
      revision_number: 1,
      base_revision_id: null,
      theme_id: "editorial",
      profile: { basics: { name: "MCP Owner", label: "Product Manager" } },
      summary: "A product leader.",
      summary_provenance: null,
      created_at: "2026-07-21T00:00:00.000Z",
    }];
    response.end(JSON.stringify(rows));
    return;
  }
  if (requestUrl.pathname === "/rest/v1/cv_editing_sessions") {
    response.setHeader("Content-Type", "application/json");
    const rows = requestUrl.searchParams.get("cv_id") === "eq.cv-another-user"
      ? []
      : [mcpEditingSessionRow];
    response.end(JSON.stringify(rows));
    return;
  }
  if (requestUrl.pathname === "/rest/v1/cv_blocks") {
    response.setHeader("Content-Type", "application/json");
    const rows = requestUrl.searchParams.get("id") === "eq.block-another-user" ? [] : [{
      id: "block-mcp",
      owner_id: "mcp-owner",
      kind: "experience",
      title: "Product launch",
      status: "active",
      current_version_id: "version-mcp",
      created_at: "2026-07-21T00:00:00.000Z",
      updated_at: "2026-07-21T00:00:00.000Z",
      cv_block_contexts: [],
      versions: [{
        id: "version-mcp",
        block_id: "block-mcp",
        version_number: 1,
        schema_version: "1",
        content: { text: "Launched a product used by one million people." },
        source_type: "human",
        source_metadata: {},
        based_on_version_id: null,
        created_at: "2026-07-21T00:00:00.000Z",
      }],
    }];
    response.end(JSON.stringify(rows));
    return;
  }
  if (requestUrl.pathname === "/rest/v1/cv_block_versions") {
    response.setHeader("Content-Type", "application/json");
    const requestedIds = requestUrl.searchParams.get("id") || "";
    const rows = requestedIds.includes("version-another-user") ? [] : [{
      id: "version-mcp",
      block_id: "block-mcp",
      owner_id: "mcp-owner",
      version_number: 1,
      schema_version: "1",
      content: { text: "Launched a product used by one million people." },
      source_type: "human",
      source_metadata: {},
      based_on_version_id: null,
      created_at: "2026-07-21T00:00:00.000Z",
    }];
    response.end(JSON.stringify(rows));
    return;
  }
  if (requestUrl.pathname === "/rest/v1/rpc/get_cv_revision_snapshot") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    response.setHeader("Content-Type", "application/json");
    if (input.p_cv_id !== "cv-mcp" || input.p_revision_id !== "revision-mcp") {
      response.end("null");
      return;
    }
    response.end(JSON.stringify({
      id: "revision-mcp",
      cvId: "cv-mcp",
      number: 1,
      baseRevisionId: null,
      themeId: "editorial",
      profile: { basics: { name: "MCP Owner", label: "Product Manager" } },
      summary: "A product leader.",
      selections: [{
        blockId: "block-mcp",
        versionId: "version-mcp",
        section: "experience",
        order: 0,
        content: { text: "Launched a product used by one million people." },
        block: { kind: "experience", title: "Product launch" },
        group: {
          occasionId: "google-product-manager",
          employer: "Google",
          role: "Product Manager",
          startDate: "2020-01",
        },
      }],
    }));
    return;
  }
  if (requestUrl.pathname === "/rest/v1/rpc/get_cv_editing_session") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    response.setHeader("Content-Type", "application/json");
    if (input.p_session_id !== "session-mcp") {
      response.end("null");
      return;
    }
    response.end(JSON.stringify(mcpEditingSessionRow));
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

  it("serves read-only CV tools and schema resources through a real MCP client contract", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(url("/mcp")), {
      requestInit: { headers: { authorization: `Bearer ${mcpAccessToken}` } },
    });
    const client = new Client({ name: "Resume Studio contract test", version: "1.0.0" });
    await client.connect(transport);
    try {
      const discovered = await client.listTools();
      expect(discovered.tools.map((tool) => tool.name)).toContain("list_cvs");
      const read = await client.callTool({ name: "list_cvs", arguments: {} });
      expect(read.structuredContent).toMatchObject({
        schemaVersion: "1",
        data: [{ id: "cv-mcp" }],
      });
    } finally {
      await client.close();
    }

    let requestId = 20;
    const mcp = async (method, params = {}) => {
      const response = await fetch(url("/mcp"), {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${mcpAccessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
      });
      const text = await response.text();
      expect(response.status, text).toBe(200);
      return JSON.parse(text);
    };
    const call = (name, args = {}) => mcp("tools/call", { name, arguments: args });

    const tools = await mcp("tools/list");
    const toolNames = tools.result.tools.map((tool) => tool.name);
    expect(toolNames).toEqual(expect.arrayContaining([
      "list_cvs",
      "get_cv_revision",
      "list_editing_sessions",
      "list_cv_blocks",
      "get_block_version",
      "get_publication_state",
      "get_supported_schemas",
      "export_cv_revision",
    ]));
    expect(toolNames).not.toEqual(expect.arrayContaining([
      "save_cv",
      "apply_change_proposal",
      "delete_cv_block",
    ]));

    const resources = await mcp("resources/list");
    expect(resources.result.resources.map((resource) => resource.uri)).toEqual(expect.arrayContaining([
      "resume-studio://schemas/block-content/v1",
      "resume-studio://schemas/composition/v1",
      "resume-studio://schemas/change-proposal/v1",
      "resume-studio://adapters",
    ]));
    const composition = await mcp("resources/read", {
      uri: "resume-studio://schemas/composition/v1",
    });
    expect(JSON.parse(composition.result.contents[0].text)).toMatchObject({
      schemaVersion: "1",
      data: { exactBlockVersions: true, maxVersionsPerBlockIdentity: 1 },
    });

    const cvs = await call("list_cvs");
    expect(cvs.result.structuredContent).toMatchObject({
      schemaVersion: "1",
      data: [{ id: "cv-mcp", name: "Product Manager at Google" }],
    });
    const revision = await call("get_cv_revision", {
      cvId: "cv-mcp",
      revisionId: "revision-mcp",
    });
    expect(revision.result.structuredContent.data.selections[0]).toMatchObject({
      blockId: "block-mcp",
      versionId: "version-mcp",
    });
    const sessions = await call("list_editing_sessions", { cvId: "cv-mcp" });
    expect(sessions.result.structuredContent.data[0]).toMatchObject({
      id: "session-mcp",
      cvId: "cv-mcp",
      optimisticVersion: 2,
    });
    const blocks = await call("list_cv_blocks");
    expect(blocks.result.structuredContent.data[0]).toMatchObject({
      id: "block-mcp",
      currentVersion: { id: "version-mcp" },
    });
    const blockVersion = await call("get_block_version", { versionId: "version-mcp" });
    expect(blockVersion.result.structuredContent.data).toMatchObject({
      id: "version-mcp",
      blockId: "block-mcp",
      schemaVersion: "1",
    });
    const publication = await call("get_publication_state", { cvId: "cv-mcp" });
    expect(publication.result.structuredContent.data).toMatchObject({
      status: "published",
      publishedRevisionId: "revision-mcp",
    });
    const schemas = await call("get_supported_schemas");
    expect(schemas.result.structuredContent.data.blockContent.currentVersion).toBe("1");
    const exported = await call("export_cv_revision", {
      cvId: "cv-mcp",
      revisionId: "revision-mcp",
    });
    expect(exported.result.structuredContent).toMatchObject({
      schemaVersion: "1",
      data: {
        adapter: "json-resume",
        adapterVersion: "1",
        payload: { work: [{ name: "Google", highlights: ["Launched a product used by one million people."] }] },
      },
    });

    const otherUserCv = await call("get_cv", { cvId: "cv-another-user" });
    expect(otherUserCv.result).toMatchObject({ isError: true });
    expect(otherUserCv.result.content[0].text).toContain('"code": "not-found"');
    const otherUserRevision = await call("get_cv_revision", {
      cvId: "cv-another-user",
      revisionId: "revision-another-user",
    });
    expect(otherUserRevision.result).toMatchObject({ isError: true });
    const otherUserVersion = await call("get_block_version", {
      versionId: "version-another-user",
    });
    expect(otherUserVersion.result).toMatchObject({ isError: true });

    const invalid = await call("get_cv", {});
    expect(invalid.result).toMatchObject({ isError: true });
    expect(invalid.result.content[0].text).toMatch(/validation|invalid/i);
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
