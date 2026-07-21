import { describe, expect, it, vi } from "vitest";
import {
  collectMcpTargetIdentities,
  recordMcpAuditEvent,
} from "./mcpAudit";
import {
  createMcpRateLimiter,
  enforceMcpSharedRateLimit,
  McpRateLimitError,
} from "./mcpRateLimit";
import {
  sanitizeMcpChangeResponse,
  sanitizeMcpErrorContext,
} from "./mcpResponseSafety";
import {
  assertMcpMutationInputSize,
  mcpChangeResult,
} from "./mcpPayloadSafety";

const ids = {
  proposal: "00000000-0000-4000-8000-000000000001",
  cv: "00000000-0000-4000-8000-000000000002",
  block: "00000000-0000-4000-8000-000000000003",
  version1: "00000000-0000-4000-8000-000000000004",
  version2: "00000000-0000-4000-8000-000000000005",
  revision: "00000000-0000-4000-8000-000000000006",
  session: "00000000-0000-4000-8000-000000000007",
};

describe("MCP release hardening", () => {
  it("enforces a fixed-window limit without mixing client buckets", () => {
    let now = 1_000;
    const limiter = createMcpRateLimiter({
      limit: 2,
      windowMs: 1_000,
      now: () => now,
    });

    expect(limiter.consume("actor-1:client-1")).toMatchObject({ remaining: 1 });
    expect(limiter.consume("actor-1:client-1")).toMatchObject({ remaining: 0 });
    expect(() => limiter.consume("actor-1:client-1")).toThrow(McpRateLimitError);
    expect(limiter.consume("actor-1:client-2")).toMatchObject({ remaining: 1 });

    now = 2_001;
    expect(limiter.consume("actor-1:client-1")).toMatchObject({ remaining: 1 });
  });

  it("uses the shared database limiter for authenticated tool limits", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { allowed: true, remaining: 2, retryAfterSeconds: 60 }, error: null })
      .mockResolvedValueOnce({ data: { allowed: false, remaining: 0, retryAfterSeconds: 42 }, error: null });
    const input = {
      client: { rpc },
      oauthClient: { id: "client-1" },
      kind: "mutation",
      limit: 3,
      windowMs: 60_000,
    };
    await expect(enforceMcpSharedRateLimit(input)).resolves.toMatchObject({ remaining: 2 });
    await expect(enforceMcpSharedRateLimit(input)).rejects.toMatchObject({
      code: "rate-limit-exceeded", retryAfterSeconds: 42,
    });
    expect(rpc).toHaveBeenCalledWith("enforce_mcp_rate_limit", {
      p_client_id: "client-1",
      p_scope: "mutation",
    });
  });

  it("collects only bounded target identities from inputs and results", () => {
    const identities = collectMcpTargetIdentities({
      proposalId: ids.proposal,
      target: { type: "editing_session", id: ids.session },
      operations: [{
        type: "append_block_version",
        blockId: ids.block,
        basedOnVersionId: ids.version1,
        content: { text: "private CV content" },
      }],
      accessToken: "access-token-secret",
    }, {
      result: {
        cvId: ids.cv,
        revisionId: ids.revision,
        affectedIdentities: { versionIds: [ids.version2] },
      },
    });

    expect(identities).toEqual({
      proposalIds: [ids.proposal],
      cvIds: [ids.cv],
      blockIds: [ids.block],
      versionIds: [ids.version1, ids.version2],
      revisionIds: [ids.revision],
      editingSessionIds: [ids.session],
    });
    expect(JSON.stringify(identities)).not.toMatch(/private CV content|access-token-secret|operations/i);
  });

  it("does not mistake arbitrary CV content for audit identities", () => {
    expect(collectMcpTargetIdentities({
      cvId: "private CV sentence",
      target: { type: "editing_session", id: ids.session },
      operations: [{
        type: "replace_working_state",
        value: {
          summaryProvenance: { cvId: "private CV sentence" },
          profile: { blockId: "private profile sentence" },
          selections: [{ blockId: "block-1", versionId: "version-1" }],
        },
      }],
    })).toEqual({ editingSessionIds: [ids.session] });
  });

  it("bounds mutation requests and responses before proposal content can be stored or echoed", () => {
    expect(() => assertMcpMutationInputSize({ content: "x".repeat(300_000) }))
      .toThrowError(expect.objectContaining({ statusCode: 413 }));
    expect(() => mcpChangeResult({ diff: { content: "x".repeat(1_100_000) } }))
      .toThrowError(expect.objectContaining({ statusCode: 413 }));
  });

  it("records a server-derived audit event without tokens, content, or proposal payloads", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "audit-1", error: null });
    const event = await recordMcpAuditEvent({
      client: { rpc },
      actor: { id: "actor-1" },
      oauthClient: { id: "chat-client-1" },
      operation: "propose_content_changes",
      input: {
        target: { type: "editing_session", id: ids.session },
        operations: [{ content: { text: "private CV content" } }],
        accessToken: "access-token-secret",
      },
      output: { id: ids.proposal, operations: [{ content: "raw proposal payload" }] },
      result: "succeeded",
    });

    expect(event).toMatchObject({
      actorId: "actor-1",
      clientId: "chat-client-1",
      operation: "propose_content_changes",
      targetIdentities: {
        proposalIds: [ids.proposal],
        editingSessionIds: [ids.session],
      },
      result: "succeeded",
    });
    expect(rpc).toHaveBeenCalledWith("record_mcp_audit_event", {
      p_client_id: "chat-client-1",
      p_operation: "propose_content_changes",
      p_target_identities: event.targetIdentities,
      p_result: "succeeded",
      p_error_code: null,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/private CV content|access-token-secret|raw proposal payload/i);
  });

  it("fails closed when a required audit event cannot be persisted", async () => {
    const logger = { error: vi.fn() };
    await expect(recordMcpAuditEvent({
      client: { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("offline") }) },
      actor: { id: "actor-1" },
      oauthClient: { id: "client-1" },
      operation: "list_cvs",
      input: {},
      result: "succeeded",
      logger,
    })).rejects.toMatchObject({ code: "audit-unavailable", statusCode: 503 });
    expect(logger.error).toHaveBeenCalledWith("MCP audit persistence failed", expect.any(Object));
  });

  it("removes normalized operations and unsafe error context from MCP responses", () => {
    expect(sanitizeMcpChangeResponse({
      id: "proposal-1",
      status: "pending",
      operations: [{ content: { text: "raw proposal payload" } }],
      diff: { fields: [{ path: "summary", after: "reviewable diff" }] },
    })).toEqual({
      id: "proposal-1",
      status: "pending",
      diff: { fields: [{ path: "summary", after: "reviewable diff" }] },
    });

    expect(sanitizeMcpErrorContext({
      reason: "stale-proposal",
      target: {
        id: "session-1",
        status: "open",
        optimisticVersion: 3,
        workingSummary: "private CV content",
        selections: [{ content: "raw proposal payload" }],
      },
      refreshToken: "refresh-token-secret",
    })).toEqual({
      reason: "stale-proposal",
      target: { id: "session-1", status: "open", optimisticVersion: 3 },
    });
  });
});
