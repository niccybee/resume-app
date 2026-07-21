import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { runMcpRead } from "./mcpReadService";

export function defineMcpReadTool({ read, ...definition }) {
  return defineMcpTool({
    ...definition,
    inputSchema: definition.inputSchema || {},
    annotations: { readOnlyHint: true },
    handler: async (args = {}) => runMcpRead((service) => read(service, args)),
  });
}
