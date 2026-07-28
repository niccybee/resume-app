import { z } from "zod";
import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import {
  mcpIdSchema,
  mcpWorkingStateSchema,
} from "../../../utils/mcpCrudSchemas";

export default defineMcpChangeTool({
  name: "propose_update_cv",
  title: "Propose updating a CV",
  description: "Replace one open Editing Session's Working Composition through a reviewed Change Proposal. Retrieve the Editing Session first and send its complete intended state.",
  inputSchema: {
    schemaVersion: z.literal("1"),
    sessionId: mcpIdSchema,
    baseVersion: z.number().int().positive(),
    value: mcpWorkingStateSchema,
  },
  change: (service, {
    schemaVersion,
    sessionId,
    baseVersion,
    value,
  }) => service.proposeContentChanges({
    schemaVersion,
    target: { type: "editing_session", id: sessionId },
    baseVersion,
    operations: [{ type: "replace_working_state", value }],
  }),
});
