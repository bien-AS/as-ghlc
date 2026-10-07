import { z } from "zod";

/*
 * The notification contract (spec 08), shaped after spec 09's sketch, whose
 * field lists are assumed. Client-safe: no server-only imports, no fixtures.
 */

/** The three types named in the source documents (spec 08). */
export const NOTIFICATION_TYPES = [
  "suspect_to_review",
  "proposal_signed",
  "invoice_draft_ready",
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;
