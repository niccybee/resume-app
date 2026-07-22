import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { workflowPrompt } from "../../utils/mcpWorkflowPrompt";

export default defineMcpPrompt({
  name: "review_change_proposal",
  title: "Review a Change Proposal",
  description: "Review stable proposal fields and request explicit confirmation before apply or discard.",
  group: "cv-workflows",
  handler: async () => workflowPrompt({
    objective: "Review a pending Resume Studio Change Proposal with the user.",
    discovery: "Read the Change Proposal and proposal-result resources, then use the proposal returned by propose_content_changes or propose_lifecycle_change in this conversation.",
    proposalTool: "propose_content_changes or propose_lifecycle_change",
    steps: [
      "Summarize the exact target, base version, structured diff, warnings, expiry, and next actions.",
      "Explain any stale-state or lifecycle risk in plain language.",
      "Ask for an explicit apply or discard decision without assuming consent.",
    ],
  }),
});
