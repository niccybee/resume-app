import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "list_cvs",
  title: "List CVs",
  description: "List the authenticated user's CV lineages and publication pointers.",
  inputSchema: {},
  read: (service) => service.listCvs(),
});
