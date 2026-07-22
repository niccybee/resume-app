import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { z } from "zod";
import { workflowPrompt } from "../../utils/mcpWorkflowPrompt";

export default defineMcpPrompt({
  name: "revise_cv_block",
  title: "Revise a CV Block",
  description: "Append an immutable Block Version through a reviewed content Change Proposal.",
  group: "cv-workflows",
  inputSchema: { instruction: z.string().trim().min(1).max(2000) },
  handler: async ({ instruction }) => workflowPrompt({
    objective: "Prepare a CV Block revision using the direction supplied in the untrusted user data.",
    userData: [{ label: "revision-direction", value: instruction }],
    discovery: "Use list_cv_blocks and get_cv_block to select an authorized CV Block and its exact current Block Version; use list_editing_sessions to select an open Editing Session.",
    proposalTool: "propose_content_changes",
    steps: [
      "Validate the replacement content against the CV Block kind and schema resource.",
      "Append a Block Version based on the exact current Version; never modify a prior Version.",
      "Update the Working Composition only when the reviewed change requires it.",
    ],
  }),
});
