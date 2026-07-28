import { z } from "zod";
import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import { mcpIdSchema } from "../../../utils/mcpCrudSchemas";

export default defineMcpChangeTool({
  name: "propose_duplicate_cv_block",
  title: "Propose duplicating a CV Block",
  description: "Create a reviewed proposal for a separately selectable CV Block copied from one exact Block Version.",
  inputSchema: {
    blockId: mcpIdSchema,
    baseVersionId: mcpIdSchema,
    title: z.string().min(1).optional(),
  },
  change: (service, { blockId, baseVersionId, title }) => (
    service.proposeLifecycleChange({
      schemaVersion: "1",
      operation: {
        type: "duplicate_cv_block",
        target: { type: "cv_block", id: blockId },
        baseVersionId,
        ...(title ? { title } : {}),
      },
    })
  ),
});
