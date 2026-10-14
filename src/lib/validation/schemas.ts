import { z } from "zod";

import { verdictRecordSchema } from "@/lib/leads/schemas";

/*
 * The validation log (build packet, registry "validation-log"): every verdict
 * the AI gave on a lead, what it was based on, what it cost, and whether a
 * rep overrode it.
 */

export const validationEntrySchema = z.object({
  /** One entry per lead's verdict. */
  id: z.string(),
  at: z.iso.datetime(),
  lead: z.object({
    id: z.string(),
    name: z.string(),
    company: z.string().nullable(),
  }),
  /** What the AI said, kept as it was even after a rep reviews. */
  result: verdictRecordSchema.shape.result,
  summary: z.string(),
  /** The signals the verdict was based on. */
  reasons: z.array(z.string()),
  /** What the run cost. Null means not measured, never zero (packet rule). */
  cost: z.number().min(0).nullable(),
  /** A rep's review, when there is one. */
  override: z
    .object({
      outcome: z.enum(["cleared", "spam"]),
      by: z.string(),
      at: z.iso.datetime(),
    })
    .nullable(),
});
export type ValidationEntry = z.infer<typeof validationEntrySchema>;

export const validationLogSchema = z.object({
  items: z.array(validationEntrySchema),
});
export type ValidationLog = z.infer<typeof validationLogSchema>;

export const VALIDATION_LOG_PAGE_SIZE = 50;
