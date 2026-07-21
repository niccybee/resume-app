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
    const supabase = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } };
    const createClient = vi.fn().mockReturnValue(supabase);

    const context = await authenticateMcpRequest({
      authorization: `Bearer ${accessToken}`,
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      createClient,
      now: () => 1_800_000_000,
    });

    expect(context).toEqual({
      user,
      oauthClient: { id: "client-1" },
      accessToken,
      supabase,
    });
    expect(supabase.auth.getUser).toHaveBeenCalledWith(accessToken);
    expect(createClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "publishable-key",
      expect.objectContaining({
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      }),
    );
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
});
