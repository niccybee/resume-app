import { workspaceAccessResult } from "../../src/auth/navigation";
import { isDeveloperAccessEnabled } from "../../src/auth/developerAccess";
import { useAuthStore } from "../../src/stores/authStore";

export default defineNuxtRouteMiddleware(async (to) => {
  const developerAccess = isDeveloperAccessEnabled();
  if (developerAccess) return;

  const auth = useAuthStore();
  await auth.initialize();
  const result = workspaceAccessResult({
    user: auth.user,
    fullPath: to.fullPath,
    developerAccess,
  });

  if (result === true) return;
  return navigateTo(result, { replace: true });
});
