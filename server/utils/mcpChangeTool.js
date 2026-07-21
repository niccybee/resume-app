import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { runMcpChange } from "./mcpChangeService";

export function defineMcpChangeTool({ change, annotations, ...definition }) {
  return defineMcpTool({
    ...definition,
    annotations: {
      readOnlyHint: false,
      ...annotations,
    },
    handler: async (args = {}) => runMcpChange((service) => change(service, args)),
  });
}
