import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "get_cv_block",
  title: "Get CV Block",
  description: "Get one owned CV Block identity and all of its Block Versions.",
  inputSchema: { blockId: z.string().min(1) },
  read: (service, { blockId }) => service.getCvBlock(blockId),
});
