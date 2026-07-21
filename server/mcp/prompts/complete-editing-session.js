import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { workflowPrompt } from "../../utils/mcpWorkflowPrompt";

export default defineMcpPrompt({
  name: "complete_editing_session",
  title: "Complete an Editing Session",
  description: "Finish one open Editing Session into one immutable CV Revision without publishing it.",
  group: "cv-workflows",
  handler: async () => workflowPrompt({
    objective: "Complete an Editing Session as one immutable CV Revision.",
    discovery: "Use list_editing_sessions and get_editing_session to select and inspect an authorized open Editing Session and its current Working Composition.",
    proposalTool: "propose_lifecycle_change",
    steps: [
      "Confirm the Working Composition and exact optimistic version are current.",
      "Propose finish_editing_session and explain the next CV Revision number.",
      "Do not publish automatically; publication requires a separate exact-Revision Change Proposal.",
    ],
  }),
});
