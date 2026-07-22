import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { z } from "zod";
import { workflowPrompt } from "../../utils/mcpWorkflowPrompt";

export default defineMcpPrompt({
  name: "copy_for_new_role",
  title: "Copy for New Role",
  description: "Create an independent role-focused CV lineage while retaining its source.",
  group: "cv-workflows",
  inputSchema: { newRoleName: z.string().trim().min(1).max(500) },
  handler: async ({ newRoleName }) => workflowPrompt({
    objective: "Prepare Copy for New Role using the role name supplied in the untrusted user data.",
    userData: [{ label: "new-role-name", value: newRoleName }],
    discovery: "Use list_cvs, list_cv_revisions, and list_editing_sessions to select an authorized CV Revision or open Editing Session as the source.",
    proposalTool: "propose_lifecycle_change",
    steps: [
      "Explain that the new role receives an independent CV lineage whose first completed CV Revision is Revision 1.",
      "Keep the source Editing Session open and unchanged.",
      "Review the copied Working Composition before proposing further content changes.",
    ],
  }),
});
