import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { runMcpChange } from "./mcpChangeService";
import { runHardenedMcpTool } from "./mcpToolHardening";
import { assertMcpMutationInputSize } from "./mcpPayloadSafety";

export function defineMcpChangeTool({ change, annotations, ...definition }) {
  const operation = definition.name;
  return defineMcpTool({
    ...definition,
    annotations: {
      readOnlyHint: false,
      ...annotations,
    },
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
