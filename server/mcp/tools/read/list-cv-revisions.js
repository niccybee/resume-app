import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "list_cv_revisions",
  title: "List CV Revisions",
  description: "List immutable CV Revision metadata for one owned CV.",
  inputSchema: { cvId: z.string().min(1) },
  read: (service, { cvId }) => service.listCvRevisions(cvId),
});
