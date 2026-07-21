import { getRequestURL } from "h3";
import { useRuntimeConfig } from "#imports";
import { mcpProtectedResourceMetadata } from "../../../utils/mcpOAuth";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  return mcpProtectedResourceMetadata({
    origin: getRequestURL(event).origin,
    supabaseUrl: config.mcpSupabaseUrl,
  });
});
