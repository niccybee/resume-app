import { useRuntimeConfig } from "#imports";
import { fetchSupabaseOAuthMetadata } from "../../utils/mcpOAuth";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  return fetchSupabaseOAuthMetadata({
    supabaseUrl: config.mcpSupabaseUrl,
    kind: "openid",
  });
});
