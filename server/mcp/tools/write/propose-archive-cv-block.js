import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import { mcpIdSchema } from "../../../utils/mcpCrudSchemas";

export default defineMcpChangeTool({
  name: "propose_archive_cv_block",
  title: "Propose archiving a CV Block",
  description: "Create a reviewed proposal to archive an unreferenced CV Block while retaining its immutable Block Versions.",
  inputSchema: {
    blockId: mcpIdSchema,
    baseVersionId: mcpIdSchema,
  },
  change: (service, { blockId, baseVersionId }) => (
    service.proposeLifecycleChange({
      schemaVersion: "1",
      operation: {
        type: "archive_cv_block",
        target: { type: "cv_block", id: blockId },
        baseVersionId,
      },
    })
  ),
});
