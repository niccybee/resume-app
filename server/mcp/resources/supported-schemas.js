import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import { supportedSchemas } from "../../../src/domain/mcp/readContracts";
import { mcpJsonResource } from "../../utils/mcpReadService";

export default defineMcpResource({
  name: "supported_schemas",
  title: "Supported Resume Studio schemas",
  description: "Aggregate versioned Block, Composition, Change Proposal, result, adapter, and glossary contracts.",
  uri: "resume-studio://schemas/v1",
  metadata: { mimeType: "application/json" },
  handler: async (uri) => mcpJsonResource(uri, supportedSchemas()),
});
