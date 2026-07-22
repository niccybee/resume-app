import { describe, expect, it, vi } from "vitest";
import {
  createMcpSettingsClient,
  McpSettingsClientError,
} from "./mcpSettings";

function query(result) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    upsert: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
  };
  return builder;
}

describe("MCP settings client", () => {
  it("treats a missing owner setting as disabled", async () => {
    const builder = query({ data: null, error: null });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }) },
      from: vi.fn().mockReturnValue(builder),
    };

    await expect(createMcpSettingsClient({ client }).getStatus()).resolves.toEqual({
      enabled: false,
      updatedAt: null,
    });
    expect(builder.eq).toHaveBeenCalledWith("owner_id", "owner-1");
  });

  it("upserts only the authenticated owner's explicit choice", async () => {
    const builder = query({
      data: { enabled: true, updated_at: "2026-07-22T11:30:00.000Z" },
      error: null,
    });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }) },
      from: vi.fn().mockReturnValue(builder),
    };

    await expect(createMcpSettingsClient({ client }).setEnabled(true)).resolves.toEqual({
      enabled: true,
      updatedAt: "2026-07-22T11:30:00.000Z",
    });
    expect(builder.upsert).toHaveBeenCalledWith(
      { owner_id: "owner-1", enabled: true },
      { onConflict: "owner_id" },
    );
  });

  it("fails closed without an authenticated user", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("signed out") }) },
    };

    await expect(createMcpSettingsClient({ client }).getStatus())
      .rejects.toEqual(expect.any(McpSettingsClientError));
  });
});
