import { createError, setResponseHeader } from "h3";
import { useEvent } from "nitropack/runtime";
import { recordMcpAuditEvent } from "./mcpAudit";
import {
  enforceMcpSharedRateLimit,
  McpRateLimitError,
  McpRateLimitStoreError,
} from "./mcpRateLimit";

export async function runHardenedMcpTool({ kind, operation, input, run }) {
  const event = useEvent();
  try {
    await enforceMcpSharedRateLimit({
      client: event.context.supabase,
      oauthClient: event.context.oauthClient,
      kind,
    });
  } catch (cause) {
    if (!(cause instanceof McpRateLimitError) && !(cause instanceof McpRateLimitStoreError)) {
      throw cause;
    }
    if (cause instanceof McpRateLimitError) {
      setResponseHeader(event, "Retry-After", String(cause.retryAfterSeconds));
    }
    await recordMcpAuditEvent({
      client: event.context.supabase,
      actor: event.context.user,
      oauthClient: event.context.oauthClient,
      operation,
      input,
      result: cause instanceof McpRateLimitError ? "rate_limited" : "failed",
      errorCode: cause.code,
    });
    throw createError({
      statusCode: cause.statusCode,
      statusMessage: cause.message,
      data: { code: cause.code },
    });
  }

  try {
    const response = await run();
    if (kind === "read") {
      await recordMcpAuditEvent({
        client: event.context.supabase,
        actor: event.context.user,
        oauthClient: event.context.oauthClient,
        operation,
        input,
        output: response?.structuredContent?.data || response?.structuredContent,
        result: "succeeded",
      });
    }
    return response;
  } catch (cause) {
    await recordMcpAuditEvent({
      client: event.context.supabase,
      actor: event.context.user,
      oauthClient: event.context.oauthClient,
      operation,
      input,
      result: "failed",
      errorCode: cause?.data?.code || cause?.code || "request-failed",
    });
    throw cause;
  }
}
