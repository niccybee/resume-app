import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import { changeProposalSchema } from "../../../src/domain/mcp/readContracts";
import { mcpJsonResource } from "../../utils/mcpReadService";

export default defineMcpResource({
  name: "change_proposal_schema",
  title: "Change Proposal contract",
  description: "Versioned proposal fields, statuses, operations, and explicit-apply rules.",
  uri: "resume-studio://schemas/change-proposal/v1",
  metadata: { mimeType: "application/json" },
  handler: async (uri) => mcpJsonResource(uri, changeProposalSchema()),
});
