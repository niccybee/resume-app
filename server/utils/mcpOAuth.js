import { z } from "zod";

const claimsSchema = z.object({
  sub: z.string().min(1),
  role: z.literal("authenticated"),
  aud: z.union([
    z.literal("authenticated"),
    z.array(z.string()).refine((audience) => audience.includes("authenticated")),
  ]),
  iss: z.string().url(),
  exp: z.number().int(),
  client_id: z.string().min(1).optional(),
});

export class McpOAuthError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "McpOAuthError";
    this.code = code;
    this.statusCode = options.statusCode || 401;
  }
}

function normalizeUrl(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new McpOAuthError("oauth-configuration-missing", `${label} is not configured.`, {
      statusCode: 503,
    });
  }
  try {
    return new URL(value).href.replace(/\/$/, "");
  } catch (cause) {
    throw new McpOAuthError("oauth-configuration-invalid", `${label} is invalid.`, {
      statusCode: 503,
      cause,
    });
  }
}

export function extractBearerToken(authorization) {
  if (typeof authorization !== "string") return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim());
  return match?.[1] || null;
}

export function mcpAuthorizationServerDiscoveryUrl(supabaseUrl) {
  return `${normalizeUrl(supabaseUrl, "Supabase URL")}/.well-known/oauth-authorization-server/auth/v1`;
}

export function mcpOpenIdConfigurationUrl(supabaseUrl) {
  return `${normalizeUrl(supabaseUrl, "Supabase URL")}/auth/v1/.well-known/openid-configuration`;
}

export function mcpProtectedResourceMetadata({ origin, supabaseUrl }) {
  const normalizedOrigin = normalizeUrl(origin, "Application origin");
  const authorizationServer = `${normalizeUrl(supabaseUrl, "Supabase URL")}/auth/v1`;
  return {
    resource: `${normalizedOrigin}/mcp`,
    authorization_servers: [authorizationServer],
    bearer_methods_supported: ["header"],
    resource_documentation: `${normalizedOrigin}/`,
  };
}

function decodePayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) throw new Error("Missing JWT payload");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch (cause) {
    throw new McpOAuthError("invalid-token", "The bearer token is malformed.", { cause });
  }
}

export async function authenticateMcpRequest({
  authorization,
  supabaseUrl,
  publishableKey,
  createClient,
  now = () => Math.floor(Date.now() / 1000),
}) {
  const accessToken = extractBearerToken(authorization);
  if (!accessToken) {
    throw new McpOAuthError("authentication-required", "A bearer access token is required.");
  }
  const url = normalizeUrl(supabaseUrl, "Supabase URL");
  if (typeof publishableKey !== "string" || !publishableKey) {
    throw new McpOAuthError(
      "oauth-configuration-missing",
      "The Supabase publishable key is not configured.",
      { statusCode: 503 },
    );
  }

  const parsed = claimsSchema.safeParse(decodePayload(accessToken));
  if (!parsed.success || parsed.data.iss !== `${url}/auth/v1` || parsed.data.exp <= now()) {
    throw new McpOAuthError("invalid-token", "The bearer token claims are invalid or expired.");
  }
  if (!parsed.data.client_id) {
    throw new McpOAuthError("oauth-client-required", "The bearer token was not issued to an OAuth client.");
  }

  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user || data.user.id !== parsed.data.sub) {
    throw new McpOAuthError(
      "invalid-token",
      "Supabase Auth did not accept this bearer token.",
      { cause: error || undefined },
    );
  }

  return {
    user: data.user,
    oauthClient: { id: parsed.data.client_id },
    accessToken,
    supabase,
  };
}

export async function fetchSupabaseOAuthMetadata({ supabaseUrl, kind, fetchImpl = fetch }) {
  const endpoint = kind === "openid"
    ? mcpOpenIdConfigurationUrl(supabaseUrl)
    : mcpAuthorizationServerDiscoveryUrl(supabaseUrl);
  let response;
  try {
    response = await fetchImpl(endpoint, { headers: { accept: "application/json" } });
  } catch (cause) {
    throw new McpOAuthError(
      "oauth-discovery-unavailable",
      "Supabase OAuth discovery is unavailable.",
      { statusCode: 503, cause },
    );
  }
  if (!response.ok) {
    throw new McpOAuthError(
      "oauth-discovery-unavailable",
      `Supabase OAuth discovery returned ${response.status}.`,
      { statusCode: 503 },
    );
  }
  const metadata = await response.json();
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new McpOAuthError(
      "oauth-discovery-invalid",
      "Supabase OAuth discovery returned invalid metadata.",
      { statusCode: 503 },
    );
  }
  return metadata;
}
