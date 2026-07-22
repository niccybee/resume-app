import { supabase } from "../supabase";
import { parseTaskPrompt } from "../domain/tasks/taskJson";

export class OpenRouterClientError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OpenRouterClientError";
    this.code = code;
  }
}

function safeStatus(data = {}) {
  return {
    configured: data.configured === true,
    model: String(data.model || "openrouter/auto"),
    updatedAt: data.updatedAt || null,
  };
}

export function createOpenRouterClient({ client, fetchImpl = globalThis.fetch }) {
  async function invoke(body) {
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.access_token) {
      throw new OpenRouterClientError(
        "authentication-required",
        "Sign in to manage OpenRouter.",
      );
    }
    let response;
    try {
      response = await fetchImpl("/api/openrouter", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new OpenRouterClientError(
        "openrouter-unavailable",
        "The OpenRouter service is temporarily unavailable.",
      );
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new OpenRouterClientError(
        typeof payload.code === "string" ? payload.code : "openrouter-unavailable",
        typeof payload.error === "string"
          ? payload.error
          : "The OpenRouter service is temporarily unavailable.",
      );
    }
    return payload;
  }

  return {
    async getStatus() {
      return safeStatus(await invoke({ action: "status" }));
    },

    async saveKey({ apiKey, model = "openrouter/auto" }) {
      return safeStatus(await invoke({ action: "save", apiKey, model }));
    },

    async verifyKey() {
      return safeStatus(await invoke({ action: "verify" }));
    },

    async removeKey() {
      return safeStatus(await invoke({ action: "delete" }));
    },

    async suggestSummary({ draft, instruction }) {
      const proposal = await invoke({
        action: "generate-summary",
        draft,
        instruction,
      });
      if (typeof proposal?.text !== "string" || !proposal.text.trim()) {
        throw new OpenRouterClientError(
          "malformed-response",
          "OpenRouter returned an invalid summary proposal.",
        );
      }
      return {
        text: proposal.text.trim(),
        provider: "openrouter",
        model: proposal.model || null,
        createdAt: proposal.createdAt || null,
      };
    },

    async generateTasks({ instruction }) {
      const payload = await invoke({ action: "generate-tasks", instruction });
      try {
        return parseTaskPrompt(JSON.stringify(payload));
      } catch (reason) {
        throw new OpenRouterClientError(
          "malformed-response",
          `OpenRouter returned invalid task JSON. ${reason.message}`,
        );
      }
    },
  };
}

export const openRouter = createOpenRouterClient({ client: supabase });
