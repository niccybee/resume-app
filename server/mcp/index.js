import { createClient } from "@supabase/supabase-js";
import { defineMcpHandler } from "@nuxtjs/mcp-toolkit/server";
import {
  createError,
  getHeader,
  getRequestIP,
  getRequestURL,
  setResponseHeader,
} from "h3";
import { useRuntimeConfig } from "#imports";
import {
  authenticateMcpRequest,
  McpOAuthError,
} from "../utils/mcpOAuth";
import {
  mcpAuthenticationRateLimit,
  McpRateLimitError,
} from "../utils/mcpRateLimit";

export default defineMcpHandler({
  name: "Resume Studio",
  version: "1.0.0",
  browserRedirect: "/",
  middleware: async (event) => {
    const config = useRuntimeConfig(event);
    const origin = getRequestURL(event).origin;
    const protectedResourceUrl = `${origin}/.well-known/oauth-protected-resource/mcp`;
    try {
      mcpAuthenticationRateLimit({
        identifier: getRequestIP(event, { xForwardedFor: true }) || "unknown-ip",
        limit: Number(config.mcpAuthenticationRateLimit) || 120,
        windowMs: Number(config.mcpRateLimitWindowMs) || 60_000,
      });
      const auth = await authenticateMcpRequest({
        authorization: getHeader(event, "authorization"),
        supabaseUrl: config.mcpSupabaseUrl,
        publishableKey: config.mcpSupabasePublishableKey,
        createClient,
        allowedUserIds: config.mcpAllowedUserIds,
        requireAllowList: true,
        gatewayKey: config.mcpGatewayKey,
        requireGateway: true,
      });
      event.context.user = auth.user;
      event.context.oauthClient = auth.oauthClient;
      event.context.supabase = auth.supabase;
    } catch (cause) {
      if (cause instanceof McpRateLimitError) {
        setResponseHeader(event, "Retry-After", String(cause.retryAfterSeconds));
      }
      if (cause instanceof McpOAuthError && cause.statusCode === 401) {
        setResponseHeader(
          event,
          "WWW-Authenticate",
          `Bearer resource_metadata="${protectedResourceUrl}"`,
        );
      }
      throw createError({
        statusCode: cause instanceof McpOAuthError || cause instanceof McpRateLimitError
          ? cause.statusCode
          : 401,
        statusMessage: cause?.message || "MCP authentication failed.",
        data: { code: cause?.code || "authentication-failed" },
      });
    }
  },
});
