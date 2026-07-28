import { z } from "zod";
import { blockContentSchema } from "../../../utils/mcpBlockSchema";
import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import { mcpIdSchema } from "../../../utils/mcpCrudSchemas";

export default defineMcpChangeTool({
  name: "propose_update_cv_block",
  title: "Propose updating a CV Block",
  description: "Append an immutable Block Version and update its occurrence in one open Editing Session through a reviewed Change Proposal.",
  inputSchema: {
    schemaVersion: z.literal("1"),
    sessionId: mcpIdSchema,
    baseVersion: z.number().int().positive(),
    blockId: mcpIdSchema,
    basedOnVersionId: mcpIdSchema,
    content: blockContentSchema,
  },
  change: (service, input) => service.proposeContentChanges({
    schemaVersion: input.schemaVersion,
    target: { type: "editing_session", id: input.sessionId },
    baseVersion: input.baseVersion,
    operations: [{
      type: "append_block_version",
      blockId: input.blockId,
      basedOnVersionId: input.basedOnVersionId,
      schemaVersion: input.schemaVersion,
      content: input.content,
    }],
  }),
});
