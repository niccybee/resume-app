import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "list_cv_blocks",
  title: "List CV Blocks",
  description: "List owned CV Blocks with their immutable Block Versions.",
  inputSchema: {
    kind: z.enum(["experience", "skill", "certification", "education", "interest"]).optional(),
    search: z.string().max(200).optional(),
    includeArchived: z.boolean().optional().default(false),
  },
  read: (service, query) => service.listCvBlocks(query),
});
