import { z } from "zod";
import { isSupportedBlockDate } from "../../src/domain/blocks/blockSchemaRegistry";

export const blockDateSchema = z.string().refine(isSupportedBlockDate, {
  message: "Date must use YYYY, YYYY-MM, or YYYY-MM-DD format.",
});

export const employmentOccasionSchema = z.strictObject({
  employer: z.string().min(1),
  role: z.string().min(1),
  startDate: blockDateSchema,
  endDate: blockDateSchema.optional(),
});

export const blockContentSchema = z.union([
  z.strictObject({
    text: z.string().min(1),
  }),
  z.strictObject({
    name: z.string().min(1),
    level: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }),
  z.strictObject({
    name: z.string().min(1),
    issuer: z.string().optional(),
    date: blockDateSchema.optional(),
    url: z.string().optional(),
  }),
  z.strictObject({
    institution: z.string().min(1),
    url: z.string().optional(),
    area: z.string().optional(),
    studyType: z.string().optional(),
    startDate: blockDateSchema.optional(),
    endDate: blockDateSchema.optional(),
    score: z.string().optional(),
    courses: z.array(z.string()).optional(),
  }),
  z.strictObject({
    name: z.string().min(1),
    keywords: z.array(z.string()).optional(),
  }),
]);
