import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import { mcpCreateBlockSchema } from "../../../utils/mcpCrudSchemas";

export default defineMcpChangeTool({
  name: "propose_create_cv_block",
  title: "Propose creating a CV Block",
  description: "Create a reviewed proposal for a new CV Block identity and its first immutable Block Version.",
  inputSchema: mcpCreateBlockSchema,
  change: (service, input) => service.proposeLifecycleChange({
    schemaVersion: "1",
    operation: {
      type: "create_cv_block",
      ...input,
    },
  }),
});
