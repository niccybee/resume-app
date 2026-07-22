import { isOAuthAuthorizationId } from "./oauthAuthorizationId";

const defaultWorkspaceDestination = "/app/cvs";

export function loginDestination(value) {
  if (typeof value !== "string") return defaultWorkspaceDestination;
  let destination;
  try {
    destination = new URL(value, "https://resume.studio");
  } catch {
    return defaultWorkspaceDestination;
  }
  const isWorkspacePath =
    destination.origin === "https://resume.studio" &&
    (destination.pathname === "/app" || destination.pathname.startsWith("/app/"));
  const oauthParameters = [...destination.searchParams.keys()];
  const isOAuthConsentRequest =
    destination.origin === "https://resume.studio" &&
    destination.pathname === "/oauth/consent" &&
    destination.hash === "" &&
    oauthParameters.length === 1 &&
    oauthParameters[0] === "authorization_id" &&
    isOAuthAuthorizationId(destination.searchParams.get("authorization_id"));
  if (!isWorkspacePath && !isOAuthConsentRequest) {
    return defaultWorkspaceDestination;
  }
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export function workspaceAccessResult({ user, fullPath, developerAccess = false }) {
  if (user || developerAccess) return true;
  return {
    path: "/login",
    query: { redirect: loginDestination(fullPath) },
  };
}
