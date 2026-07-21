import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("Nuxt MCP OAuth integration", () => {
  it("integrates the Nuxt MCP Toolkit and Zod into the Nuxt 4 runtime", async () => {
    const [packageJson, config] = await Promise.all([
      readFile(new URL("package.json", root), "utf8").then(JSON.parse),
      readFile(new URL("nuxt.config.ts", root), "utf8"),
    ]);
    expect(packageJson.packageManager).toMatch(/^bun@/);
    expect(packageJson.devDependencies).toMatchObject({
      "@nuxtjs/mcp-toolkit": expect.any(String),
      zod: expect.any(String),
    });
    expect(config).toMatch(/modules:\s*\[[^\]]*["']@nuxtjs\/mcp-toolkit["']/s);
    expect(config).toMatch(/mcp:\s*\{[\s\S]*route:\s*["']\/mcp["']/);
  });

  it("protects the MCP handler and never constructs a service-role database client", async () => {
    const [handler, authBoundary] = await Promise.all([
      readFile(new URL("server/mcp/index.js", root), "utf8"),
      readFile(new URL("server/utils/mcpOAuth.js", root), "utf8"),
    ]);
    expect(handler).toMatch(/middleware/);
    expect(handler).toMatch(/authenticateMcpRequest/);
    expect(handler).toMatch(/event\.context\.oauthClient/);
    expect(handler).toMatch(/event\.context\.supabase/);
    expect(`${handler}\n${authBoundary}`).not.toMatch(/service.?role/i);
  });

  it("provides consent and discovery routes for Supabase OAuth 2.1", async () => {
    const files = await Promise.all([
      "app/pages/oauth/consent.vue",
      "server/routes/.well-known/oauth-protected-resource.get.js",
      "server/routes/.well-known/oauth-authorization-server.get.js",
      "server/routes/.well-known/openid-configuration.get.js",
    ].map((path) => readFile(new URL(path, root), "utf8")));
    const combined = files.join("\n");
    expect(combined).toMatch(/getAuthorizationDetails/);
    expect(combined).toMatch(/approveAuthorization/);
    expect(combined).toMatch(/denyAuthorization/);
    expect(combined).toMatch(/authorization_servers/);
    expect(combined).toMatch(/oauth-authorization-server\/auth\/v1/);
  });
});
