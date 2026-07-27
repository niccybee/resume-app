import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { runMcpRead } from "./mcpReadService";
import { runHardenedMcpTool } from "./mcpToolHardening";
import {
  MCP_ENVELOPE_OUTPUT_SCHEMA,
  mcpOAuthMeta,
} from "./mcpToolMetadata";

export function defineMcpReadTool({ read, ...definition }) {
  const operation = definition.name;
  return defineMcpTool({
    ...definition,
    inputSchema: definition.inputSchema || {},
    outputSchema: definition.outputSchema || MCP_ENVELOPE_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    _meta: mcpOAuthMeta(definition._meta),
    handler: async (args = {}) => runHardenedMcpTool({
      kind: "read",
      operation,
      input: args,
      run: () => runMcpRead((service) => read(service, args)),
    }),
  });
}
