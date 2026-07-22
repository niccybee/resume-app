import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "get_block_version",
  title: "Get Block Version",
  description: "Get one owned immutable Block Version by identity.",
  inputSchema: { versionId: z.string().min(1) },
  read: (service, { versionId }) => service.getBlockVersion(versionId),
});
