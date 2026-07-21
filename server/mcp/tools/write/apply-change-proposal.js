import { z } from "zod";
import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";

export default defineMcpChangeTool({
  name: "apply_change_proposal",
  title: "Apply Change Proposal",
  description: "Explicitly apply one reviewed pending Change Proposal. Stale targets fail closed with refreshed conflict context.",
  inputSchema: { proposalId: z.string().min(1) },
  annotations: { destructiveHint: true, idempotentHint: true },
  change: (service, { proposalId }) => service.applyChangeProposal(proposalId),
});
