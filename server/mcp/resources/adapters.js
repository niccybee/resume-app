import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import { adapterCapabilities } from "../../../src/domain/mcp/readContracts";
import { mcpJsonResource } from "../../utils/mcpReadService";

export default defineMcpResource({
  name: "adapter_capabilities",
  title: "CV Composition adapter capabilities",
  description: "Supported export adapters, versions, mappings, and validation capabilities.",
  uri: "resume-studio://adapters",
  metadata: { mimeType: "application/json" },
  handler: async (uri) => mcpJsonResource(uri, adapterCapabilities()),
});
