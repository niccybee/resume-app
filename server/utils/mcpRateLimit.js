const sharedBuckets = new Map();

export class McpRateLimitError extends Error {
  constructor(message, { retryAfterSeconds }) {
    super(message);
    this.name = "McpRateLimitError";
    this.code = "rate-limit-exceeded";
    this.statusCode = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class McpRateLimitStoreError extends Error {
  constructor(message = "MCP rate limiting is temporarily unavailable.") {
    super(message);
    this.name = "McpRateLimitStoreError";
    this.code = "rate-limit-unavailable";
    this.statusCode = 503;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createMcpRateLimiter({
  limit,
  windowMs,
  now = Date.now,
  buckets = new Map(),
  maxBuckets = 10_000,
}) {
  const maximum = positiveInteger(limit, 1);
  const duration = positiveInteger(windowMs, 60_000);

  return {
    consume(key) {
      const timestamp = now();
      const current = buckets.get(key);
      if (!current && buckets.size >= maxBuckets) {
        for (const [candidate, value] of buckets) {
          if (value.resetAt <= timestamp) buckets.delete(candidate);
        }
        if (buckets.size >= maxBuckets) {
          throw new McpRateLimitError("Too many distinct MCP clients. Try again shortly.", {
            retryAfterSeconds: Math.max(1, Math.ceil(duration / 1000)),
          });
        }
      }
      const bucket = !current || current.resetAt <= timestamp
        ? { count: 0, resetAt: timestamp + duration }
        : current;
      if (bucket.count >= maximum) {
        throw new McpRateLimitError("Too many MCP requests. Try again shortly.", {
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000)),
        });
      }
      bucket.count += 1;
      buckets.set(key, bucket);
      return {
        limit: maximum,
        remaining: maximum - bucket.count,
        resetAt: bucket.resetAt,
      };
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}

function consumeShared({ scope, identifier, limit, windowMs }) {
  return createMcpRateLimiter({
    limit,
    windowMs,
    buckets: sharedBuckets,
  }).consume(`${scope}:${identifier}`);
}

export function mcpAuthenticationRateLimit({ identifier, limit = 120, windowMs = 60_000 }) {
  return consumeShared({ scope: "authentication", identifier, limit, windowMs });
}

export async function enforceMcpSharedRateLimit({
  client,
  oauthClient,
  kind,
}) {
  const { data, error } = await client.rpc("enforce_mcp_rate_limit", {
    p_client_id: oauthClient.id,
    p_scope: kind,
  });

  if (error || typeof data?.allowed !== "boolean") {
    throw new McpRateLimitStoreError();
  }
  if (!data.allowed) {
    throw new McpRateLimitError("Too many MCP requests. Try again shortly.", {
      retryAfterSeconds: positiveInteger(data.retryAfterSeconds, 60),
    });
  }
  return data;
}
