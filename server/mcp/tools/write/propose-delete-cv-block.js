import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import { mcpIdSchema } from "../../../utils/mcpCrudSchemas";

export default defineMcpChangeTool({
  name: "propose_delete_cv_block",
  title: "Propose deleting a CV Block",
  description: "Create a reviewed proposal to permanently delete a CV Block only when no CV Composition references any of its Block Versions. Otherwise archive it.",
  inputSchema: {
    blockId: mcpIdSchema,
    baseVersionId: mcpIdSchema,
  },
  change: (service, { blockId, baseVersionId }) => (
    service.proposeLifecycleChange({
      schemaVersion: "1",
      operation: {
        type: "delete_cv_block",
        target: { type: "cv_block", id: blockId },
        baseVersionId,
      },
    })
  ),
});
