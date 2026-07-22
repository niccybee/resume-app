import { describe, expect, it, vi } from "vitest";
import {
  decideOAuthAuthorization,
  loadOAuthAuthorization,
  OAuthConsentError,
} from "./oauthConsent";

describe("Supabase OAuth consent boundary", () => {
  it("loads and normalizes the requesting client for the signed-in existing user", async () => {
    const oauth = {
      getAuthorizationDetails: vi.fn().mockResolvedValue({
        data: {
          authorization_id: "authorization-1",
          redirect_uri: "https://chat.example/callback",
          client: {
            id: "client-1",
            name: "Chat Client",
            uri: "https://chat.example",
            logo_uri: "https://chat.example/logo.png",
          },
          user: { id: "owner-1", email: "owner@example.test" },
          scope: "openid email profile",
        },
        error: null,
      }),
    };

    await expect(loadOAuthAuthorization({
      oauth,
      authorizationId: "authorization-1",
      user: { id: "owner-1" },
    })).resolves.toEqual({
      type: "consent",
      authorizationId: "authorization-1",
      redirectUri: "https://chat.example/callback",
      client: {
        id: "client-1",
        name: "Chat Client",
        uri: "https://chat.example",
        logoUri: "https://chat.example/logo.png",
      },
      scopes: ["openid", "email", "profile"],
    });
  });

  it("rejects an authorization request that does not belong to the signed-in account", async () => {
    const oauth = {
      getAuthorizationDetails: vi.fn().mockResolvedValue({
        data: {
          authorization_id: "authorization-1",
          redirect_uri: "https://chat.example/callback",
          client: { id: "client-1", name: "Chat Client", uri: "", logo_uri: "" },
          user: { id: "another-user", email: "other@example.test" },
          scope: "email",
        },
        error: null,
      }),
    };

    await expect(loadOAuthAuthorization({
      oauth,
      authorizationId: "authorization-1",
      user: { id: "owner-1" },
    })).rejects.toMatchObject({
      code: "authorization-owner-mismatch",
    });
  });

  it("returns an existing grant redirect without showing consent again", async () => {
    const oauth = {
      getAuthorizationDetails: vi.fn().mockResolvedValue({
        data: { redirect_url: "https://chat.example/callback?code=existing" },
        error: null,
      }),
    };

    await expect(loadOAuthAuthorization({
      oauth,
      authorizationId: "authorization-1",
      user: { id: "owner-1" },
    })).resolves.toEqual({
      type: "redirect",
      redirectUrl: "https://chat.example/callback?code=existing",
    });
  });

  it.each(["approve", "deny"])("submits an explicit %s decision", async (decision) => {
    const response = {
      data: { redirect_url: `https://chat.example/callback?decision=${decision}` },
      error: null,
    };
    const oauth = {
      approveAuthorization: vi.fn().mockResolvedValue(response),
      denyAuthorization: vi.fn().mockResolvedValue(response),
    };

    await expect(decideOAuthAuthorization({
      oauth,
      authorizationId: "authorization-1",
      decision,
    })).resolves.toBe(response.data.redirect_url);
    expect(oauth[decision === "approve" ? "approveAuthorization" : "denyAuthorization"])
      .toHaveBeenCalledWith("authorization-1", { skipBrowserRedirect: true });
  });

  it("requires a validated authorization identifier", async () => {
    await expect(loadOAuthAuthorization({ oauth: {}, authorizationId: "", user: { id: "owner-1" } }))
      .rejects.toEqual(expect.any(OAuthConsentError));
    await expect(loadOAuthAuthorization({
      oauth: { getAuthorizationDetails: vi.fn() },
      authorizationId: "../logout",
      user: { id: "owner-1" },
    })).rejects.toMatchObject({ code: "invalid-authorization-request" });
  });
});
