import { describe, expect, it, vi } from "vitest";
import {
  authenticateMcpRequest,
  extractBearerToken,
  mcpAuthorizationServerDiscoveryUrl,
  mcpProtectedResourceMetadata,
  McpOAuthError,
} from "./mcpOAuth";

function token(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("MCP Supabase OAuth boundary", () => {
  it("publishes protected-resource metadata that delegates OAuth to Supabase", () => {
    expect(mcpProtectedResourceMetadata({
      origin: "https://resume.example",
      supabaseUrl: "https://project.supabase.co/",
    })).toEqual({
      resource: "https://resume.example/mcp",
      authorization_servers: ["https://project.supabase.co/auth/v1"],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://resume.example/",
    });
    expect(mcpAuthorizationServerDiscoveryUrl("https://project.supabase.co/"))
      .toBe("https://project.supabase.co/.well-known/oauth-authorization-server/auth/v1");
  });

  it("extracts only a well-formed bearer token", () => {
    expect(extractBearerToken("Bearer access-token")).toBe("access-token");
    expect(extractBearerToken("Basic credentials")).toBeNull();
    expect(extractBearerToken("Bearer ")).toBeNull();
  });

  it("validates the token and exposes user, OAuth client, and a user-scoped RLS client", async () => {
    const accessToken = token({
      sub: "owner-1",
      role: "authenticated",
      aud: "authenticated",
      iss: "https://project.supabase.co/auth/v1",
      client_id: "client-1",
      exp: 1999999999,
    });
    const user = { id: "owner-1", email: "owner@example.test" };
    const authClient = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } };
    const settingQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { enabled: true }, error: null }),
    };
    const supabase = { from: vi.fn().mockReturnValue(settingQuery) };
    const createClient = vi.fn()
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce(supabase);

    const context = await authenticateMcpRequest({
      authorization: `Bearer ${accessToken}`,
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      createClient,
      now: () => 1_800_000_000,
      gatewayKey: "gateway-key-with-at-least-32-characters",
      requireUserOptIn: true,
    });

    expect(context).toEqual({
      user,
      oauthClient: { id: "client-1" },
      accessToken,
      supabase,
    });
    expect(authClient.auth.getUser).toHaveBeenCalledWith(accessToken);
    expect(supabase.from).toHaveBeenCalledWith("cv_mcp_user_settings");
    expect(settingQuery.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(createClient).toHaveBeenNthCalledWith(
      1,
      "https://project.supabase.co",
      "publishable-key",
      expect.objectContaining({
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      }),
    );
    expect(createClient).toHaveBeenNthCalledWith(
      2,
      "https://project.supabase.co",
      "publishable-key",
      expect.objectContaining({
        global: { headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Resume-Studio-MCP-Gateway": "gateway-key-with-at-least-32-characters",
        } },
      }),
    );
  });

  it("fails closed when the production database gateway key is missing", async () => {
    const accessToken = token({
      sub: "owner-1", role: "authenticated", aud: "authenticated",
      iss: "https://project.supabase.co/auth/v1", client_id: "client-1", exp: 1999999999,
    });
    await expect(authenticateMcpRequest({
      authorization: `Bearer ${accessToken}`,
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      createClient: vi.fn(),
      requireGateway: true,
    })).rejects.toMatchObject({
      code: "mcp-gateway-configuration-missing",
      statusCode: 503,
    });
  });

  it.each([
    [null, "authentication-required"],
    [token({ sub: "owner-1", role: "authenticated", aud: "authenticated", iss: "https://project.supabase.co/auth/v1", exp: 1999999999 }), "oauth-client-required"],
    [token({ sub: "owner-1", role: "authenticated", aud: "authenticated", iss: "https://another.supabase.co/auth/v1", client_id: "client-1", exp: 1999999999 }), "invalid-token"],
  ])("rejects invalid MCP identity %s", async (accessToken, code) => {
    const createClient = vi.fn().mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }) },
    });

    await expect(authenticateMcpRequest({
      authorization: accessToken ? `Bearer ${accessToken}` : "",
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      createClient,
      now: () => 1_800_000_000,
    })).rejects.toMatchObject({ code });
  });

  it("rejects a token Supabase Auth no longer accepts", async () => {
    const accessToken = token({
      sub: "owner-1", role: "authenticated", aud: "authenticated",
      iss: "https://project.supabase.co/auth/v1", client_id: "client-1", exp: 1999999999,
    });
    const createClient = vi.fn().mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("revoked") }) },
    });

    await expect(authenticateMcpRequest({
      authorization: `Bearer ${accessToken}`,
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      createClient,
    })).rejects.toEqual(expect.any(McpOAuthError));
  });

  it.each([
    ["malformed", "malformed-token"],
    [token({ sub: "owner-1", role: "authenticated", aud: "another-service", iss: "https://project.supabase.co/auth/v1", client_id: "client-1", exp: 1999999999 }), "wrong-audience"],
    [token({ sub: "owner-1", role: "authenticated", aud: "authenticated", iss: "https://project.supabase.co/auth/v1", client_id: "client-1", exp: 1700000000 }), "expired-token"],
  ])("fails safely for %s", async (accessToken) => {
    const createClient = vi.fn().mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }) },
    });
    await expect(authenticateMcpRequest({
      authorization: `Bearer ${accessToken}`,
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      createClient,
      now: () => 1_800_000_000,
    })).rejects.toMatchObject({ code: "invalid-token", statusCode: 401 });
  });

  it("fails closed until the authenticated owner enables MCP", async () => {
    const accessToken = token({
      sub: "owner-2", role: "authenticated", aud: "authenticated",
      iss: "https://project.supabase.co/auth/v1", client_id: "client-1", exp: 1999999999,
    });
    const authClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-2" } }, error: null }) },
    };
    const settingQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { enabled: false }, error: null }),
    };
    const createClient = vi.fn()
      .mockReturnValueOnce(authClient)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(settingQuery) });

    await expect(authenticateMcpRequest({
      authorization: `Bearer ${accessToken}`,
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      createClient,
      gatewayKey: "gateway-key-with-at-least-32-characters",
      requireUserOptIn: true,
    })).rejects.toMatchObject({ code: "mcp-not-enabled", statusCode: 403 });
  });

  it("rejects the same OAuth token after grant revocation", async () => {
    const accessToken = token({
      sub: "owner-1", role: "authenticated", aud: "authenticated",
      iss: "https://project.supabase.co/auth/v1", client_id: "client-1", exp: 1999999999,
    });
    const getUser = vi.fn()
      .mockResolvedValueOnce({ data: { user: { id: "owner-1" } }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: new Error("grant revoked") });
    const createClient = vi.fn().mockReturnValue({ auth: { getUser } });
    const input = {
      authorization: `Bearer ${accessToken}`,
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      createClient,
    };

    await expect(authenticateMcpRequest(input)).resolves.toMatchObject({ user: { id: "owner-1" } });
    await expect(authenticateMcpRequest(input)).rejects.toMatchObject({ code: "invalid-token" });
  });
});
