import { isOAuthAuthorizationId } from "./oauthAuthorizationId";

const defaultWorkspaceDestination = "/app/cvs";
const pendingExternalAuthDestinationKey = "resume-studio:pending-auth-destination";

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

export function externalAuthCallbackUrl(origin) {
  return new URL("/login", origin).href;
}

export function rememberExternalAuthDestination(storage, value) {
  const destination = loginDestination(value);
  try {
    storage?.setItem?.(pendingExternalAuthDestinationKey, destination);
  } catch {
    // Browser privacy settings can disable storage. The login page still
    // falls back to the default workspace destination in that case.
  }
  return destination;
}

export function pendingExternalAuthDestination(storage) {
  try {
    return loginDestination(storage?.getItem?.(pendingExternalAuthDestinationKey));
  } catch {
    return defaultWorkspaceDestination;
  }
}

export function clearPendingExternalAuthDestination(storage) {
  try {
    storage?.removeItem?.(pendingExternalAuthDestinationKey);
  } catch {
    // A completed sign-in must not fail because storage cleanup is blocked.
  }
}

export function workspaceAccessResult({ user, fullPath, developerAccess = false }) {
  if (user || developerAccess) return true;
  return {
    path: "/login",
    query: { redirect: loginDestination(fullPath) },
  };
}
