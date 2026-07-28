import { z } from "zod";
import {
  blockContentSchema,
  employmentOccasionSchema,
} from "./mcpBlockSchema";

export const mcpIdSchema = z.string().min(1);
export const mcpBlockKindSchema = z.enum([
  "experience",
  "skill",
  "certification",
  "education",
  "interest",
]);

export const mcpSelectionSchema = z.object({
  blockId: mcpIdSchema,
  versionId: mcpIdSchema,
  section: z.enum([
    "experience",
    "skills",
    "certifications",
    "education",
    "interests",
  ]),
  order: z.number().int().nonnegative(),
  content: blockContentSchema.optional(),
  block: z.record(z.string(), z.unknown()).optional(),
  group: z.record(z.string(), z.unknown()).optional(),
});

export const mcpWorkingStateSchema = z.object({
  name: z.string().min(1),
  themeId: z.string().nullable().optional(),
  profile: z.record(z.string(), z.unknown()).default({}),
  summary: z.string().default(""),
  summaryProvenance: z.record(z.string(), z.unknown()).nullable().optional(),
  selections: z.array(mcpSelectionSchema).default([]),
});

export const mcpCreateBlockSchema = {
  kind: mcpBlockKindSchema,
  title: z.string().min(1),
  schemaVersion: z.literal("1"),
  content: blockContentSchema,
  employmentOccasion: employmentOccasionSchema.optional(),
};
