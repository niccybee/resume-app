import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { runMcpChange } from "./mcpChangeService";
import { runHardenedMcpTool } from "./mcpToolHardening";
import { assertMcpMutationInputSize } from "./mcpPayloadSafety";
import {
  MCP_ENVELOPE_OUTPUT_SCHEMA,
  mcpOAuthMeta,
} from "./mcpToolMetadata";

export function defineMcpChangeTool({ change, annotations, ...definition }) {
  const operation = definition.name;
  return defineMcpTool({
    ...definition,
    outputSchema: definition.outputSchema || MCP_ENVELOPE_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      ...annotations,
    },
    _meta: mcpOAuthMeta(definition._meta),
    handler: async (args = {}) => runHardenedMcpTool({
      kind: "mutation",
      operation,
      input: args,
      run: () => {
        assertMcpMutationInputSize(args);
        return runMcpChange((service) => change(service, args));
      },
    }),
  });
}
