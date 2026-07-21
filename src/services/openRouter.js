import { supabase } from "../supabase";

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

async function mapError(error) {
  if (!error) return;
  if (error.context?.json) {
    try {
      const payload = await error.context.clone().json();
      if (typeof payload?.error === "string") {
        throw new OpenRouterClientError(
          typeof payload.code === "string" ? payload.code : "openrouter-unavailable",
          payload.error,
        );
      }
    } catch (reason) {
      if (reason instanceof OpenRouterClientError) throw reason;
    }
  }
  throw new OpenRouterClientError(
    "openrouter-unavailable",
    error.message || "The OpenRouter service is temporarily unavailable.",
  );
}

export function createOpenRouterClient({ client }) {
  async function invoke(body) {
    const { data, error } = await client.functions.invoke("openrouter", { body });
    await mapError(error);
    return data;
  }

  return {
    async getStatus() {
      return safeStatus(await invoke({ action: "status" }));
    },

    async saveKey({ apiKey, model = "openrouter/auto" }) {
      return safeStatus(await invoke({ action: "save", apiKey, model }));
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
  };
}

export const openRouter = createOpenRouterClient({ client: supabase });
