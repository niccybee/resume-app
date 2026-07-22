import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import { proposalResultContract } from "../../../src/domain/mcp/readContracts";
import { mcpJsonResource } from "../../utils/mcpReadService";

export default defineMcpResource({
  name: "change_proposal_result_contract",
  title: "Change Proposal result contract",
  description: "Stable status, next-action, operation-result, and conflict-code fields.",
  uri: "resume-studio://schemas/change-proposal-result/v1",
  metadata: { mimeType: "application/json" },
  handler: async (uri) => mcpJsonResource(uri, proposalResultContract()),
});
