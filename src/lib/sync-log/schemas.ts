import { z } from "zod";

import { writeResult, writeType } from "@/db/schema";

/*
 * The sync log contract (spec 06, "The sync log screen"), shared by the Route
 * Handlers, the hook and the data-access layer (ADR-0003). The enums are the
 * database's own (drizzle definitions only, no connection).
 */

export const SYNC_LOG_PAGE_SIZE = 50;

/** Query of GET /api/admin/sync-log. Every value arrives as text from the address. */
export const listSyncLogQuerySchema = z.strictObject({
  writeType: z.enum(writeType.enumValues).optional(),
  result: z.enum(writeResult.enumValues).optional(),
  /** The id of the last entry of the previous page. */
  cursor: z.uuid().optional(),
});
export type ListSyncLogQuery = z.infer<typeof listSyncLogQuerySchema>;

/** The path of POST /api/admin/sync-log/[id]/retry. */
export const syncLogIdSchema = z.uuid();

/**
 * How long a write may stay pending before it counts as stopped: longer than
 * the slowest write the runner can make (two GHL requests, each up to five
 * 15s attempts with four 60s 429 waits between them, about 10.5 minutes).
 * ponytail: a time guess, not proof the send stopped; a write still running
 * past it can be sent twice (harmless for set-to-a-value writes, see runWrite).
 * Record a heartbeat on the row if that ever matters.
 */
export const STALE_PENDING_MS = 11 * 60_000;

/**
 * Whether Retry may re-send a write: it failed, or it has been pending past
 * STALE_PENDING_MS (the process stopped after its decision committed). A fresh
 * pending write may still be in flight. The server also refuses a write that
 * a newer one replaced.
 */
export const canRetry = (
  entry: { result: SyncLogEntry["result"]; updatedAt: Date | string },
  now = Date.now(),
) =>
  entry.result === "failed" ||
  (entry.result === "pending" &&
    now - new Date(entry.updatedAt).getTime() > STALE_PENDING_MS);

/** Retry takes no options: the body is `{}`. */
export const retryInputSchema = z.strictObject({});

export const syncLogEntrySchema = z.object({
  id: z.string(),
  leadId: z.string().nullable(),
  writeType: z.enum(writeType.enumValues),
  idempotencyKey: z.string(),
  /** The request sent (or that would have been sent) to GHL. */
  payload: z.unknown(),
  result: z.enum(writeResult.enumValues),
  /** GHL's answer, token redacted. */
  response: z.unknown(),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SyncLogEntry = z.infer<typeof syncLogEntrySchema>;

export const syncLogPageSchema = z.object({
  items: z.array(syncLogEntrySchema),
  nextCursor: z.string().nullable(),
});
export type SyncLogPage = z.infer<typeof syncLogPageSchema>;

/** Query of GET /api/admin/sync-log/webhooks: the second tab, newest first. */
export const listWebhookEventsQuerySchema = z.strictObject({
  /** The id of the last event of the previous page. */
  cursor: z.uuid().optional(),
});
export type ListWebhookEventsQuery = z.infer<
  typeof listWebhookEventsQuerySchema
>;

export const webhookEventEntrySchema = z.object({
  id: z.string(),
  provider: z.string(),
  eventId: z.string(),
  /** The event's `event` parameter, or "unknown" when it had none. */
  type: z.string(),
  verified: z.boolean(),
  /** As received, secrets redacted when it was recorded. */
  payload: z.unknown(),
  /** What was done with it; null while it waits to be applied. */
  outcome: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WebhookEventEntry = z.infer<typeof webhookEventEntrySchema>;

export const webhookEventPageSchema = z.object({
  items: z.array(webhookEventEntrySchema),
  nextCursor: z.string().nullable(),
});
export type WebhookEventPage = z.infer<typeof webhookEventPageSchema>;
