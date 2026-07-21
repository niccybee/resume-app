import { configureSupabase } from "../../src/supabase";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  configureSupabase({
    url: config.public.supabaseUrl,
    publishableKey: config.public.supabasePublishableKey,
  });
});
