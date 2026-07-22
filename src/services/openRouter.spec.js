import { describe, expect, it, vi } from "vitest";
import { createOpenRouterClient } from "./openRouter";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createHarness(body, status = 200) {
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "user-token" } },
        error: null,
      }),
    },
  };
  const fetchImpl = vi.fn().mockResolvedValue(response(body, status));
  return {
    client,
    fetchImpl,
    openRouter: createOpenRouterClient({ client, fetchImpl }),
  };
}

describe("OpenRouter authenticated Nuxt client boundary", () => {
  it("returns only non-sensitive provider status", async () => {
    const { openRouter, fetchImpl } = createHarness({
      configured: true,
      model: "openai/gpt-4.1-mini",
      updatedAt: "2026-07-21T01:00:00.000Z",
      apiKey: "must-never-reach-vue",
      vaultSecretId: "secret-id",
    });

    await expect(openRouter.getStatus()).resolves.toEqual({
      configured: true,
      model: "openai/gpt-4.1-mini",
      updatedAt: "2026-07-21T01:00:00.000Z",
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/openrouter", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer user-token" }),
      body: JSON.stringify({ action: "status" }),
    }));
  });

  it("submits a replacement key without retaining or returning it", async () => {
    const { openRouter, fetchImpl } = createHarness({
      configured: true,
      model: "openrouter/auto",
      updatedAt: "2026-07-21T01:00:00.000Z",
      apiKey: "sk-or-secret",
    });

    const result = await openRouter.saveKey({
      apiKey: "sk-or-secret",
      model: "openrouter/auto",
    });

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      action: "save",
      apiKey: "sk-or-secret",
      model: "openrouter/auto",
    });
    expect(result).toEqual({
      configured: true,
      model: "openrouter/auto",
      updatedAt: "2026-07-21T01:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("sk-or-secret");
  });

  it("verifies and removes the stored configuration through Nuxt", async () => {
    const { openRouter, fetchImpl } = createHarness({
      configured: true,
      model: "openrouter/auto",
    });

    await openRouter.verifyKey();
    await openRouter.removeKey();

    expect(fetchImpl.mock.calls.map((call) => JSON.parse(call[1].body))).toEqual([
      { action: "verify" },
      { action: "delete" },
    ]);
  });

  it("uses the Nuxt server's safe error and never echoes the submitted key", async () => {
    const { openRouter } = createHarness({
      code: "openrouter-error",
      error: "OpenRouter rejected that API key.",
    }, 400);

    await expect(openRouter.saveKey({ apiKey: "rejected", model: "openrouter/auto" }))
      .rejects.toMatchObject({
        code: "openrouter-error",
        message: "OpenRouter rejected that API key.",
      });
  });

  it("requests a reviewable summary proposal with current CV context", async () => {
    const { openRouter, fetchImpl } = createHarness({
      text: "A focused product leader.",
      model: "openai/gpt-4.1-mini",
      createdAt: "2026-07-21T01:00:00.000Z",
    });
    const draft = {
      name: "Product CV",
      summary: "Existing summary",
      profile: { basics: { label: "Product Lead" } },
      selections: [{ versionId: "version-1", content: { text: "Shipped a platform." } }],
    };

    await expect(openRouter.suggestSummary({
      draft,
      instruction: "Focus on cross-functional leadership",
    })).resolves.toEqual({
      text: "A focused product leader.",
      provider: "openrouter",
      model: "openai/gpt-4.1-mini",
      createdAt: "2026-07-21T01:00:00.000Z",
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      action: "generate-summary",
      draft,
      instruction: "Focus on cross-functional leadership",
    });
  });

  it("rejects malformed summary and task proposals", async () => {
    const summary = createHarness({ text: "" }).openRouter;
    await expect(summary.suggestSummary({ draft: {}, instruction: "Improve it" }))
      .rejects.toMatchObject({ code: "malformed-response" });

    const tasks = createHarness({ type: "create_tasks", version: 2, tasks: [] }).openRouter;
    await expect(tasks.generateTasks({ instruction: "Describe my work" }))
      .rejects.toMatchObject({ code: "malformed-response" });
  });

  it("requires an authenticated session before calling the Nuxt route", async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    };
    const fetchImpl = vi.fn();
    const openRouter = createOpenRouterClient({ client, fetchImpl });

    await expect(openRouter.getStatus()).rejects.toMatchObject({
      code: "authentication-required",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
