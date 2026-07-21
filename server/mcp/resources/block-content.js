import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import {
  BLOCK_SCHEMA_REGISTRY,
  BLOCK_SCHEMA_VERSION,
} from "../../../src/domain/blocks/blockSchemaRegistry";
import { mcpJsonResource } from "../../utils/mcpReadService";

export default defineMcpResource({
  name: "block_content_schemas",
  title: "CV Block content schemas",
  description: "Validated fields for every supported CV Block kind and schema version.",
  uri: "resume-studio://schemas/block-content/v1",
  metadata: { mimeType: "application/json" },
  handler: async (uri) => mcpJsonResource(uri, {
    currentVersion: BLOCK_SCHEMA_VERSION,
    versions: BLOCK_SCHEMA_REGISTRY,
  }),
});
