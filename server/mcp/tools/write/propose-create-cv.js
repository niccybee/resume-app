import { z } from "zod";
import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import { mcpWorkingStateSchema } from "../../../utils/mcpCrudSchemas";

export default defineMcpChangeTool({
  name: "propose_create_cv",
  title: "Propose creating a CV",
  description: "Create a reviewed Change Proposal for a new CV and its first open Editing Session. Nothing is created until apply_change_proposal is explicitly called.",
  inputSchema: {
    schemaVersion: z.literal("1"),
    value: mcpWorkingStateSchema,
  },
  change: (service, { schemaVersion, value }) => service.proposeLifecycleChange({
    schemaVersion,
    operation: {
      type: "create_cv",
      value,
    },
  }),
});
