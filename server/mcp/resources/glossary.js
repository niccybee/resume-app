import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import { domainGlossary } from "../../../src/domain/mcp/readContracts";
import { mcpJsonResource } from "../../utils/mcpReadService";

export default defineMcpResource({
  name: "resume_studio_glossary",
  title: "Resume Studio glossary",
  description: "Preferred domain language, definitions, immutability, and avoided synonyms.",
  uri: "resume-studio://glossary/v1",
  metadata: { mimeType: "application/json" },
  handler: async (uri) => mcpJsonResource(uri, domainGlossary()),
});
