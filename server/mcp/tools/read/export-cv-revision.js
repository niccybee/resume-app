import { z } from "zod";
import { defineMcpReadTool } from "../../../utils/mcpReadTool";

export default defineMcpReadTool({
  name: "export_cv_revision",
  title: "Export CV Revision",
  description: "Export one exact owned CV Revision through a supported composition adapter.",
  inputSchema: {
    cvId: z.string().min(1),
    revisionId: z.string().min(1),
    adapter: z.literal("json-resume").optional().default("json-resume"),
    adapterVersion: z.literal("1").optional().default("1"),
  },
  read: (service, { cvId, revisionId, adapter, adapterVersion }) => (
    service.exportCvRevision(cvId, revisionId, adapter, adapterVersion)
  ),
});
