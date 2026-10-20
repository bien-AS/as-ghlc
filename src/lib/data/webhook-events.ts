import { desc, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { webhookEvents } from "@/db/schema";
import {
  type ListWebhookEventsQuery,
  SYNC_LOG_PAGE_SIZE,
  type WebhookEventEntry,
  type WebhookEventPage,
} from "@/lib/sync-log/schemas";

import { requireAdmin } from "./users";

/*
 * Data access for the sync log's webhooks tab (spec 06): admin only. `db` is
 * the privileged connection (ADR-0007); webhook_events has RLS on with no
 * policies, so `requireAdmin` here is the access check. Payloads were
 * redacted when they were recorded (src/app/api/webhooks/ghl/route.ts).
 */

const toEntry = (
  row: typeof webhookEvents.$inferSelect,
): WebhookEventEntry => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Every webhook received, newest first, with what was done with it. */
export async function listWebhookEvents(
  query: ListWebhookEventsQuery,
): Promise<WebhookEventPage> {
  await requireAdmin();
  const t = webhookEvents;
  const rows = await db
    .select()
    .from(t)
    .where(
      query.cursor
        ? sql`(${t.createdAt}, ${t.id}) < (select created_at, id from webhook_events where id = ${query.cursor})`
        : undefined,
    )
    .orderBy(desc(t.createdAt), desc(t.id))
    .limit(SYNC_LOG_PAGE_SIZE + 1);
  const items = rows.slice(0, SYNC_LOG_PAGE_SIZE).map(toEntry);
  return {
    items,
    nextCursor:
      rows.length > SYNC_LOG_PAGE_SIZE ? (items.at(-1)?.id ?? null) : null,
  };
}
