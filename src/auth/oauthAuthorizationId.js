const oauthAuthorizationIdPattern = /^[A-Za-z0-9_-]{1,512}$/;

export function isOAuthAuthorizationId(value) {
  return typeof value === "string" && oauthAuthorizationIdPattern.test(value);
}
