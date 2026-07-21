import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { useEvent } from "nitropack/runtime";
import { z } from "zod";

export default defineMcpTool({
  name: "get_connection_identity",
  title: "Get connection identity",
  description: "Return the Resume Studio user and OAuth client for this authenticated MCP request.",
  outputSchema: {
    userId: z.string(),
    email: z.string().nullable(),
    oauthClientId: z.string(),
  },
  annotations: { readOnlyHint: true },
  handler: async () => {
    const event = useEvent();
    const identity = {
      userId: event.context.user.id,
      email: event.context.user.email || null,
      oauthClientId: event.context.oauthClient.id,
    };
    return {
      structuredContent: identity,
      content: [{ type: "text", text: JSON.stringify(identity) }],
    };
  },
});
