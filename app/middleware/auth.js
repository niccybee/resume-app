import { workspaceAccessResult } from "../../src/auth/navigation";
import { useAuthStore } from "../../src/stores/authStore";

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();
  const result = workspaceAccessResult({
    user: auth.user,
    fullPath: to.fullPath,
  });

  if (result === true) return;
  return navigateTo(result, { replace: true });
});
