import { isOAuthAuthorizationId } from "./oauthAuthorizationId";

export class OAuthConsentError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "OAuthConsentError";
    this.code = code;
  }
}

function requireAuthorizationId(authorizationId) {
  if (!isOAuthAuthorizationId(authorizationId)) {
    throw new OAuthConsentError(
      "invalid-authorization-request",
      "This authorization request is missing or invalid.",
    );
  }
  return authorizationId;
}

function requireRedirectUrl(data) {
  if (typeof data?.redirect_url !== "string" || !data.redirect_url) {
    throw new OAuthConsentError(
      "invalid-authorization-response",
      "The authorization server did not return a redirect URL.",
    );
  }
  return data.redirect_url;
}

export async function loadOAuthAuthorization({ oauth, authorizationId, user }) {
  const id = requireAuthorizationId(authorizationId);
  if (!user?.id || typeof oauth?.getAuthorizationDetails !== "function") {
    throw new OAuthConsentError(
      "authentication-required",
      "Sign in with an existing Resume Studio account to continue.",
    );
  }

  const { data, error } = await oauth.getAuthorizationDetails(id);
  if (error) {
    throw new OAuthConsentError(
      "authorization-request-failed",
      error.message || "The authorization request could not be loaded.",
      { cause: error },
    );
  }
  if (data?.redirect_url) {
    return { type: "redirect", redirectUrl: requireRedirectUrl(data) };
  }
  if (!data?.client?.id || data.authorization_id !== id) {
    throw new OAuthConsentError(
      "invalid-authorization-request",
      "The authorization request could not be verified.",
    );
  }
  if (data.user?.id !== user.id) {
    throw new OAuthConsentError(
      "authorization-owner-mismatch",
      "This authorization request does not belong to the signed-in account.",
    );
  }

  return {
    type: "consent",
    authorizationId: id,
    redirectUri: data.redirect_uri || "",
    client: {
      id: data.client.id,
      name: data.client.name || "Unnamed MCP client",
      uri: data.client.uri || "",
      logoUri: data.client.logo_uri || "",
    },
    scopes: typeof data.scope === "string"
      ? [...new Set(data.scope.split(/\s+/).filter(Boolean))]
      : [],
  };
}

export async function decideOAuthAuthorization({ oauth, authorizationId, decision }) {
  const id = requireAuthorizationId(authorizationId);
  if (decision !== "approve" && decision !== "deny") {
    throw new OAuthConsentError(
      "invalid-consent-decision",
      "Choose whether to approve or deny this connection.",
    );
  }
  const method = decision === "approve"
    ? oauth?.approveAuthorization
    : oauth?.denyAuthorization;
  if (typeof method !== "function") {
    throw new OAuthConsentError(
      "authorization-unavailable",
      "OAuth authorization is not available.",
    );
  }

  const { data, error } = await method.call(oauth, id, {
    skipBrowserRedirect: true,
  });
  if (error) {
    throw new OAuthConsentError(
      "authorization-decision-failed",
      error.message || "The authorization decision could not be saved.",
      { cause: error },
    );
  }
  return requireRedirectUrl(data);
}
