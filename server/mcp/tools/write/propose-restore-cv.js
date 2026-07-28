import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import { mcpIdSchema } from "../../../utils/mcpCrudSchemas";

export default defineMcpChangeTool({
  name: "propose_restore_cv",
  title: "Propose restoring a CV",
  description: "Create a reviewed proposal to restore an archived CV to the active workspace.",
  inputSchema: { cvId: mcpIdSchema },
  change: (service, { cvId }) => service.proposeLifecycleChange({
    schemaVersion: "1",
    operation: { type: "restore_cv", target: { type: "cv", id: cvId } },
  }),
});
