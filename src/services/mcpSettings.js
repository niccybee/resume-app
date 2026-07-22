import { supabase } from "../supabase";

export class McpSettingsClientError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "McpSettingsClientError";
    this.code = code;
  }
}

function statusFromRow(row) {
  return {
    enabled: row?.enabled === true,
    updatedAt: row?.updated_at || null,
  };
}

export function createMcpSettingsClient({ client }) {
  async function authenticatedUser() {
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user?.id) {
      throw new McpSettingsClientError(
        "authentication-required",
        "Sign in to manage MCP access.",
        { cause: error || undefined },
      );
    }
    return data.user;
  }

  return {
    async getStatus() {
      const user = await authenticatedUser();
      const { data, error } = await client
        .from("cv_mcp_user_settings")
        .select("enabled, updated_at")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) {
        throw new McpSettingsClientError(
          "mcp-settings-unavailable",
          "MCP settings are temporarily unavailable.",
          { cause: error },
        );
      }
      return statusFromRow(data);
    },

    async setEnabled(enabled) {
      if (typeof enabled !== "boolean") {
        throw new McpSettingsClientError(
          "invalid-mcp-setting",
          "MCP access must be enabled or disabled explicitly.",
        );
      }
      const user = await authenticatedUser();
      const { data, error } = await client
        .from("cv_mcp_user_settings")
        .upsert({ owner_id: user.id, enabled }, { onConflict: "owner_id" })
        .select("enabled, updated_at")
        .single();
      if (error) {
        throw new McpSettingsClientError(
          "mcp-settings-save-failed",
          "MCP access could not be updated.",
          { cause: error },
        );
      }
      return statusFromRow(data);
    },
  };
}

export const mcpSettings = createMcpSettingsClient({ client: supabase });
