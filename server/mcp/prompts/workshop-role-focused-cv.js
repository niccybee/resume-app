import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { z } from "zod";
import { workflowPrompt } from "../../utils/mcpWorkflowPrompt";

export default defineMcpPrompt({
  name: "workshop_role_focused_cv",
  title: "Workshop a role-focused CV",
  description: "Guide a role-focused CV workshop using exact Block Versions and reviewed changes.",
  group: "cv-workflows",
  inputSchema: { targetRole: z.string().trim().min(1).max(500) },
  handler: async ({ targetRole }) => workflowPrompt({
    objective: "Workshop a role-focused CV using the target role supplied in the untrusted user data.",
    userData: [{ label: "target-role", value: targetRole }],
    discovery: "Read the glossary and supported schemas, then use list_cvs, list_cv_revisions, list_editing_sessions, and list_cv_blocks to understand the authorized workspace.",
    proposalTool: "propose_content_changes or propose_lifecycle_change",
    steps: [
      "Ask what outcomes and evidence matter for the target role.",
      "Recommend exact Block Versions and explain the proposed Working Composition.",
      "Use Copy for New Role when the work needs an independent CV lineage.",
    ],
  }),
});
