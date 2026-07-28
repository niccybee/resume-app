import { z } from "zod";
import { blockContentSchema, employmentOccasionSchema } from "../../../utils/mcpBlockSchema";
import { defineMcpChangeTool } from "../../../utils/mcpChangeTool";
import { mcpWorkingStateSchema } from "../../../utils/mcpCrudSchemas";

const id = z.string().min(1);
const cvTarget = z.object({ type: z.literal("cv"), id });
const blockTarget = z.object({ type: z.literal("cv_block"), id });
const sessionTarget = z.object({ type: z.literal("editing_session"), id });
const revisionTarget = z.object({ type: z.literal("cv_revision"), id, cvId: id });
const revisionSource = revisionTarget;
const sessionSource = sessionTarget;
const blockKind = z.enum(["experience", "skill", "certification", "education", "interest"]);

const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_cv"), value: mcpWorkingStateSchema }),
  z.object({ type: z.literal("start_editing_session"), target: cvTarget, baseRevisionId: id.nullable().optional() }),
  z.object({ type: z.literal("resume_editing_session"), target: sessionTarget, baseOptimisticVersion: z.number().int().positive() }),
  z.object({ type: z.literal("finish_editing_session"), target: sessionTarget, baseOptimisticVersion: z.number().int().positive() }),
  z.object({ type: z.literal("copy_to_new_version"), source: z.union([revisionSource, sessionSource]), baseOptimisticVersion: z.number().int().positive().optional() }),
  z.object({ type: z.literal("copy_for_new_role"), source: z.union([revisionSource, sessionSource]), name: z.string().min(1), baseOptimisticVersion: z.number().int().positive().optional() }),
  z.object({ type: z.literal("archive_editing_session"), target: sessionTarget, baseOptimisticVersion: z.number().int().positive() }),
  z.object({ type: z.literal("restore_editing_session"), target: sessionTarget, baseOptimisticVersion: z.number().int().positive() }),
  z.object({ type: z.literal("archive_cv"), target: cvTarget }),
  z.object({ type: z.literal("restore_cv"), target: cvTarget }),
  z.object({ type: z.literal("archive_cv_block"), target: blockTarget, baseVersionId: id }),
  z.object({ type: z.literal("restore_cv_block"), target: blockTarget, baseVersionId: id }),
  z.object({
    type: z.literal("create_cv_block"),
    kind: blockKind,
    title: z.string().min(1),
    schemaVersion: z.literal("1"),
    content: blockContentSchema,
    employmentOccasion: employmentOccasionSchema.optional(),
  }),
  z.object({ type: z.literal("duplicate_cv_block"), target: blockTarget, baseVersionId: id, title: z.string().min(1).optional() }),
  z.object({ type: z.literal("delete_cv_block"), target: blockTarget, baseVersionId: id }),
  z.object({ type: z.literal("publish_revision"), target: revisionTarget, slug: z.string().min(1) }),
  z.object({ type: z.literal("withdraw_publication"), target: cvTarget }),
]);

export default defineMcpChangeTool({
  name: "propose_lifecycle_change",
  title: "Propose lifecycle change",
  description: "Validate an Editing Session, CV, CV Block, or publication lifecycle change without mutating its target. Review the returned diff, then call apply_change_proposal explicitly.",
  inputSchema: { operation: operationSchema },
  annotations: { destructiveHint: false, idempotentHint: false },
  change: (service, input) => service.proposeLifecycleChange(input),
});
