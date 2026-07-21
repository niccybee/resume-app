import { configureSupabase, supabase } from "../../src/supabase";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  configureSupabase({
    url: config.public.supabaseUrl,
    publishableKey: config.public.supabasePublishableKey,
  });

  nuxtApp.$router.beforeEach(async (to) => {
    if (!to.matched.some((record) => record.meta.requiresAuth)) return true;

    const { data } = await supabase.auth.getSession();
    if (data?.session) return true;

    return { name: "Login", query: { redirect: to.fullPath } };
  });
});
