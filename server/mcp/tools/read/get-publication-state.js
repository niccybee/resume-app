import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "get_publication_state",
  title: "Get publication state",
  description: "Inspect the stable slug and exact Published Revision pointer for one CV.",
  inputSchema: { cvId: z.string().min(1) },
  read: (service, { cvId }) => service.getPublicationState(cvId),
});
