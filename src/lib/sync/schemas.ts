import { z } from "zod";

/*
 * The GHL seam (build packet: "every write to GHL is visible and logged").
 * Every change the app makes to the CRM goes through one write path and lands
 * here, so a person can see what was sent, when, and whether it was skipped.
 */

export const SYNC_KINDS = [
  "stage_write",
  "status_write",
  "booking_cancel",
] as const;
export const syncKindSchema = z.enum(SYNC_KINDS);
export type SyncKind = z.infer<typeof syncKindSchema>;

/** `skipped_duplicate`: the same idempotency key was already sent, so nothing was sent again. */
export const SYNC_OUTCOMES = ["sent", "skipped_duplicate", "failed"] as const;
export const syncOutcomeSchema = z.enum(SYNC_OUTCOMES);
export type SyncOutcome = z.infer<typeof syncOutcomeSchema>;

export const syncEntrySchema = z.object({
  id: z.string(),
  at: z.iso.datetime(),
  kind: syncKindSchema,
  outcome: syncOutcomeSchema,
  /** One line, in words: what was written and why. */
  summary: z.string(),
  idempotencyKey: z.string(),
  lead: z.object({ id: z.string(), name: z.string() }),
  /** Who caused the write: a person's name, or "System". */
  actor: z.string(),
});
export type SyncEntry = z.infer<typeof syncEntrySchema>;

/** What a data-access function hands the write path. The id and time are not input. */
export type SyncWriteInput = Omit<SyncEntry, "id" | "at" | "outcome">;

export const SYNC_LOG_PAGE_SIZE = 25;

export const syncLogSchema = z.object({ items: z.array(syncEntrySchema) });
export type SyncLog = z.infer<typeof syncLogSchema>;
