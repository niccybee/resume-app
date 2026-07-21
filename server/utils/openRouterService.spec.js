import { describe, expect, it, vi } from "vitest";
import { createOpenRouterServer } from "./openRouterService";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createHarness(handler) {
  const fetchImpl = vi.fn(async (url, init = {}) => {
    if (String(url).endsWith("/auth/v1/user")) return response({ id: "owner-1" });
    return handler(String(url), init);
  });
  return {
    fetchImpl,
    server: createOpenRouterServer({
      fetchImpl,
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      serviceRoleKey: "server-only-role-key",
      now: () => "2026-07-21T01:00:00.000Z",
    }),
  };
}

describe("Nuxt OpenRouter server boundary", () => {
  it("returns only non-sensitive Vault-backed status", async () => {
    const { server, fetchImpl } = createHarness((url, init) => {
      expect(url).toContain("/rest/v1/rpc/cv_ai_status");
      expect(init.headers.Authorization).toBe("Bearer server-only-role-key");
      return response({
        configured: true,
        model: "openai/gpt-4.1-mini",
        updatedAt: "2026-07-21T00:00:00.000Z",
        apiKey: "must-not-leak",
        vaultSecretId: "must-not-leak",
      });
    });

    const result = await server.handle({
      authorization: "Bearer user-token",
      body: { action: "status" },
    });

    expect(result).toEqual({
      configured: true,
      model: "openai/gpt-4.1-mini",
      updatedAt: "2026-07-21T00:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("verifies a stored key without returning the decrypted credential", async () => {
    const { server } = createHarness((url) => {
      if (url.includes("cv_ai_credentials")) {
        return response({ model: "openrouter/auto", apiKey: "vault-secret" });
      }
      if (url === "https://openrouter.ai/api/v1/key") return response({ data: {} });
      if (url.includes("cv_ai_status")) {
        return response({ configured: true, model: "openrouter/auto", apiKey: "vault-secret" });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await server.handle({
      authorization: "Bearer user-token",
      body: { action: "verify" },
    });

    expect(result).toEqual({ configured: true, model: "openrouter/auto", updatedAt: null });
    expect(JSON.stringify(result)).not.toContain("vault-secret");
  });

  it("returns a Summary Change Proposal without calling a persistence RPC", async () => {
    const calls = [];
    const { server } = createHarness((url) => {
      calls.push(url);
      if (url.includes("cv_ai_credentials")) {
        return response({ model: "openrouter/auto", apiKey: "vault-secret" });
      }
      if (url === "https://openrouter.ai/api/v1/chat/completions") {
        return response({
          model: "openai/gpt-4.1-mini",
          choices: [{ message: { content: "A focused product leader." } }],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const draft = { name: "Product CV", summary: "Original summary" };

    const proposal = await server.handle({
      authorization: "Bearer user-token",
      body: {
        action: "generate-summary",
        instruction: "Focus on product leadership",
        draft,
      },
    });

    expect(proposal).toEqual({
      text: "A focused product leader.",
      model: "openai/gpt-4.1-mini",
      createdAt: "2026-07-21T01:00:00.000Z",
    });
    expect(draft.summary).toBe("Original summary");
    expect(calls.some((url) => /cv_ai_(save|delete)/.test(url))).toBe(false);
  });

  it("rejects a provider response with more than 20 proposed CV Blocks", async () => {
    const tasks = Array.from({ length: 21 }, (_, index) => ({
      employer: "E2",
      role: "Growth Lead",
      occasionId: `e2-growth-lead-${index}`,
      startDate: "2024-02",
      endDate: "present",
      item: `Achievement ${index + 1}`,
    }));
    const { server } = createHarness((url) => {
      if (url.includes("cv_ai_credentials")) {
        return response({ model: "openrouter/auto", apiKey: "vault-secret" });
      }
      if (url === "https://openrouter.ai/api/v1/chat/completions") {
        return response({
          choices: [{
            message: {
              content: JSON.stringify({ type: "create_tasks", version: 1, tasks }),
            },
          }],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await expect(server.handle({
      authorization: "Bearer user-token",
      body: { action: "generate-tasks", instruction: "Describe all achievements" },
    })).rejects.toMatchObject({
      code: "malformed-response",
      message: "OpenRouter must return between 1 and 20 proposed CV Blocks.",
    });
  });

  it("rejects unauthenticated requests before reading Vault settings", async () => {
    const fetchImpl = vi.fn();
    const server = createOpenRouterServer({
      fetchImpl,
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      serviceRoleKey: "server-only-role-key",
    });

    await expect(server.handle({ body: { action: "status" } })).rejects.toMatchObject({
      code: "authentication-required",
      status: 401,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
