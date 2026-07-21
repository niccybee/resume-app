import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "get_editing_session",
  title: "Get Editing Session",
  description: "Get one owned Editing Session and its exact Working Composition.",
  inputSchema: { sessionId: z.string().min(1) },
  read: (service, { sessionId }) => service.getEditingSession(sessionId),
});
