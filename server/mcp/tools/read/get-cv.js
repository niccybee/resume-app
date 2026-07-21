import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "get_cv",
  title: "Get CV",
  description: "Get one owned CV lineage by identity.",
  inputSchema: { cvId: z.string().min(1).describe("CV identity") },
  read: (service, { cvId }) => service.getCv(cvId),
});
