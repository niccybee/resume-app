import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { workflowPrompt } from "../../utils/mcpWorkflowPrompt";

export default defineMcpPrompt({
  name: "copy_to_new_version",
  title: "Copy to New Version",
  description: "Create another open Editing Session in the same CV lineage without closing its source.",
  group: "cv-workflows",
  handler: async () => workflowPrompt({
    objective: "Prepare Copy to New Version within the same role-focused CV lineage.",
    discovery: "Use list_cvs, list_cv_revisions, and list_editing_sessions to select an authorized CV Revision or open Editing Session as the source.",
    proposalTool: "propose_lifecycle_change",
    steps: [
      "Explain that the copy remains in the same CV lineage.",
      "Keep the source Editing Session open and unchanged.",
      "Use the exact optimistic version when the source is an Editing Session.",
    ],
  }),
});
