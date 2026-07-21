import { createRouter, createWebHistory } from "vue-router";
import { supabase } from "../supabase";
import { routes } from "./routes";

export { routes } from "./routes";

export function createAppRouter(
  history = createWebHistory(),
  { getSession = () => supabase.auth.getSession() } = {},
) {
  const appRouter = createRouter({
    history,
    routes,
  });
  appRouter.beforeEach(async (to) => {
    if (!to.matched.some((record) => record.meta.requiresAuth)) return true;
    const { data } = await getSession();
    if (data?.session) return true;
    return { name: "Login", query: { redirect: to.fullPath } };
  });
  return appRouter;
}

const router = createAppRouter();

export default router;
