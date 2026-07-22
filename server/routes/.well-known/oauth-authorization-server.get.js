import { useRuntimeConfig } from "#imports";
import { fetchSupabaseOAuthMetadata } from "../../utils/mcpOAuth";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  // Proxies Supabase's oauth-authorization-server/auth/v1 metadata, including
  // authorization code + PKCE, refresh, and dynamic registration endpoints.
  return fetchSupabaseOAuthMetadata({
    supabaseUrl: config.mcpSupabaseUrl,
    kind: "oauth",
  });
});
