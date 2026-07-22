import { z } from "zod";
import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";

export default defineMcpChangeTool({
  name: "discard_change_proposal",
  title: "Discard Change Proposal",
  description: "Discard one pending Change Proposal without changing its CV Block or Working Composition target.",
  inputSchema: { proposalId: z.string().min(1) },
  annotations: { destructiveHint: false, idempotentHint: true },
  change: (service, { proposalId }) => service.discardChangeProposal(proposalId),
});
