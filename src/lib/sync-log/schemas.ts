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
