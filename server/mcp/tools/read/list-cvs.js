import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "list_cvs",
  title: "List CVs",
  description: "List the authenticated user's CV lineages and publication pointers.",
  inputSchema: { limit: z.number().int().min(1).max(100).optional().default(50) },
  read: (service, { limit }) => service.listCvs({ limit }),
});
