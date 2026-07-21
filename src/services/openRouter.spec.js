import { describe, expect, it, vi } from "vitest";
import { createOpenRouterClient } from "./openRouter";

describe("OpenRouter authenticated client boundary", () => {
  it("returns only non-sensitive provider status", async () => {
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: {
            configured: true,
            model: "openai/gpt-4.1-mini",
            updatedAt: "2026-07-21T01:00:00.000Z",
            apiKey: "must-never-reach-vue",
            vaultSecretId: "secret-id",
          },
          error: null,
        }),
      },
    };
    const openRouter = createOpenRouterClient({ client });

    await expect(openRouter.getStatus()).resolves.toEqual({
      configured: true,
      model: "openai/gpt-4.1-mini",
      updatedAt: "2026-07-21T01:00:00.000Z",
    });
    expect(client.functions.invoke).toHaveBeenCalledWith("openrouter", {
      body: { action: "status" },
    });
  });

  it("submits a replacement key without retaining or returning it", async () => {
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: {
            configured: true,
            model: "openrouter/auto",
            updatedAt: "2026-07-21T01:00:00.000Z",
            apiKey: "sk-or-secret",
          },
          error: null,
        }),
      },
    };
    const openRouter = createOpenRouterClient({ client });

    const result = await openRouter.saveKey({
      apiKey: "sk-or-secret",
      model: "openrouter/auto",
    });

    expect(client.functions.invoke).toHaveBeenCalledWith("openrouter", {
      body: {
        action: "save",
        apiKey: "sk-or-secret",
        model: "openrouter/auto",
      },
    });
    expect(result).toEqual({
      configured: true,
      model: "openrouter/auto",
      updatedAt: "2026-07-21T01:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("sk-or-secret");
  });

  it("surfaces a safe service error and never echoes the submitted key", async () => {
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "OpenRouter rejected that API key." },
        }),
      },
    };
    const openRouter = createOpenRouterClient({ client });

    await expect(openRouter.saveKey({
      apiKey: "sk-or-rejected",
      model: "openrouter/auto",
    })).rejects.toMatchObject({
      code: "openrouter-unavailable",
      message: "OpenRouter rejected that API key.",
    });
  });

  it("uses the Edge Function's safe error message for rejected keys", async () => {
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: "Edge Function returned a non-2xx status code",
            context: new Response(JSON.stringify({
              code: "openrouter-error",
              error: "OpenRouter rejected that API key.",
            }), { status: 400, headers: { "Content-Type": "application/json" } }),
          },
        }),
      },
    };
    const openRouter = createOpenRouterClient({ client });

    await expect(openRouter.saveKey({ apiKey: "rejected", model: "openrouter/auto" }))
      .rejects.toMatchObject({
        code: "openrouter-error",
        message: "OpenRouter rejected that API key.",
      });
  });

  it("requests a reviewable summary proposal with the current draft context", async () => {
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: {
            text: "A focused product leader.",
            model: "openai/gpt-4.1-mini",
            createdAt: "2026-07-21T01:00:00.000Z",
          },
          error: null,
        }),
      },
    };
    const openRouter = createOpenRouterClient({ client });
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
    expect(client.functions.invoke).toHaveBeenCalledWith("openrouter", {
      body: {
        action: "generate-summary",
        draft,
        instruction: "Focus on cross-functional leadership",
      },
    });
  });

  it("rejects a malformed summary response", async () => {
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: { text: "" }, error: null }),
      },
    };
    const openRouter = createOpenRouterClient({ client });

    await expect(openRouter.suggestSummary({ draft: {}, instruction: "Improve it" }))
      .rejects.toMatchObject({
        code: "malformed-response",
        message: "OpenRouter returned an invalid summary proposal.",
      });
  });
});
