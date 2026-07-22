import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "get_cv_revision",
  title: "Get CV Revision",
  description: "Get one exact immutable CV Revision with its CV Composition.",
  inputSchema: {
    cvId: z.string().min(1),
    revisionId: z.string().min(1),
  },
  read: (service, { cvId, revisionId }) => service.getCvRevision(cvId, revisionId),
});
