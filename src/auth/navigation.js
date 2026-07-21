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
  if (!isWorkspacePath) {
    return defaultWorkspaceDestination;
  }
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export function workspaceAccessResult({ user, fullPath }) {
  if (user) return true;
  return {
    path: "/login",
    query: { redirect: loginDestination(fullPath) },
  };
}
