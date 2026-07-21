import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import { compositionSchema } from "../../../src/domain/mcp/readContracts";
import { mcpJsonResource } from "../../utils/mcpReadService";

export default defineMcpResource({
  name: "composition_schema",
  title: "CV Composition schema",
  description: "Ordering, exact Block Version, and one-identity constraints for CV Compositions.",
  uri: "resume-studio://schemas/composition/v1",
  metadata: { mimeType: "application/json" },
  handler: async (uri) => mcpJsonResource(uri, compositionSchema()),
});
