import { z } from "zod";

export const MCP_OAUTH_SECURITY_SCHEMES = [{
  type: "oauth2",
  scopes: ["openid", "email", "profile"],
}];

export const MCP_ENVELOPE_OUTPUT_SCHEMA = {
  schemaVersion: z.literal("1"),
  data: z.unknown(),
};

export function mcpOAuthMeta(meta = {}) {
  return {
    ...meta,
    securitySchemes: MCP_OAUTH_SECURITY_SCHEMES,
  };
}
