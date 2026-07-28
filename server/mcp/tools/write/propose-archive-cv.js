import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import { mcpIdSchema } from "../../../utils/mcpCrudSchemas";

export default defineMcpChangeTool({
  name: "propose_archive_cv",
  title: "Propose archiving a CV",
  description: "Create a reviewed proposal to archive a CV. Archiving retains its Revisions and does not archive shared CV Blocks.",
  inputSchema: { cvId: mcpIdSchema },
  change: (service, { cvId }) => service.proposeLifecycleChange({
    schemaVersion: "1",
    operation: { type: "archive_cv", target: { type: "cv", id: cvId } },
  }),
});
