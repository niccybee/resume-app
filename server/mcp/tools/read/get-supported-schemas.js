import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "get_supported_schemas",
  title: "Get supported schemas",
  description: "Get current CV Block, CV Composition, adapter, and Change Proposal contracts.",
  inputSchema: {},
  read: (service) => service.getSupportedSchemas(),
});
