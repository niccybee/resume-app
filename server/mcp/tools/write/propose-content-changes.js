import { z } from "zod";
import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";

const selectionSchema = z.object({
  blockId: z.string().min(1),
  versionId: z.string().min(1),
  section: z.enum(["experience", "skills", "certifications", "education", "interests"]),
  order: z.number().int().nonnegative(),
  content: z.record(z.string(), z.unknown()).optional(),
  block: z.record(z.string(), z.unknown()).optional(),
  group: z.record(z.string(), z.unknown()).optional(),
});

const operationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("append_block_version"),
    blockId: z.string().min(1),
    basedOnVersionId: z.string().min(1),
    schemaVersion: z.literal("1"),
    content: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("replace_working_state"),
    value: z.object({
      name: z.string().min(1),
      themeId: z.string().nullable().optional(),
      profile: z.record(z.string(), z.unknown()).default({}),
      summary: z.string().default(""),
      summaryProvenance: z.record(z.string(), z.unknown()).nullable().optional(),
      selections: z.array(selectionSchema),
    }),
  }),
]);

export default defineMcpChangeTool({
  name: "propose_content_changes",
  title: "Propose content changes",
  description: "Validate CV Block and Working Composition changes without mutating their target. Review the returned diff, then call apply_change_proposal explicitly.",
  inputSchema: {
    schemaVersion: z.literal("1"),
    target: z.object({
      type: z.literal("editing_session"),
      id: z.string().min(1),
    }),
    baseVersion: z.number().int().positive(),
    operations: z.array(operationSchema).min(1).max(50),
  },
  annotations: { destructiveHint: false, idempotentHint: false },
  change: (service, input) => service.proposeContentChanges(input),
});
