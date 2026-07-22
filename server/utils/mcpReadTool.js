import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { runMcpRead } from "./mcpReadService";
import { runHardenedMcpTool } from "./mcpToolHardening";

export function defineMcpReadTool({ read, ...definition }) {
  const operation = definition.name;
  return defineMcpTool({
    ...definition,
    inputSchema: definition.inputSchema || {},
    annotations: { readOnlyHint: true },
    handler: async (args = {}) => runHardenedMcpTool({
      kind: "read",
      operation,
      input: args,
      run: () => runMcpRead((service) => read(service, args)),
    }),
  });
}
