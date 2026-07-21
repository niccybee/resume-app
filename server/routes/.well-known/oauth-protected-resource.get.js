import { getRequestURL } from "h3";
import { useRuntimeConfig } from "#imports";
import { mcpProtectedResourceMetadata } from "../../utils/mcpOAuth";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const {
    resource,
    authorization_servers,
    bearer_methods_supported,
    resource_documentation,
  } = mcpProtectedResourceMetadata({
    origin: getRequestURL(event).origin,
    supabaseUrl: config.mcpSupabaseUrl,
  });
  return {
    resource,
    authorization_servers,
    bearer_methods_supported,
    resource_documentation,
  };
});
