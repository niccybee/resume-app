import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "list_editing_sessions",
  title: "List Editing Sessions",
  description: "List durable Editing Sessions and their Working Composition metadata for one CV.",
  inputSchema: {
    cvId: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional().default(50),
  },
  read: (service, { cvId, limit }) => service.listEditingSessions(cvId, { limit }),
});
