import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import { mcpIdSchema } from "../../../utils/mcpCrudSchemas";

export default defineMcpChangeTool({
  name: "propose_restore_cv_block",
  title: "Propose restoring a CV Block",
  description: "Create a reviewed proposal to restore an archived CV Block without changing its Block Versions.",
  inputSchema: {
    blockId: mcpIdSchema,
    baseVersionId: mcpIdSchema,
  },
  change: (service, { blockId, baseVersionId }) => (
    service.proposeLifecycleChange({
      schemaVersion: "1",
      operation: {
        type: "restore_cv_block",
        target: { type: "cv_block", id: blockId },
        baseVersionId,
      },
    })
  ),
});
