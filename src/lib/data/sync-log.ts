import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { ghlSyncLog } from "@/db/schema";
import { runWrite, type WritePlan } from "@/lib/services/ghl/runner";
import {
  type ListSyncLogQuery,
  SYNC_LOG_PAGE_SIZE,
  type SyncLogEntry,
  type SyncLogPage,
} from "@/lib/sync-log/schemas";

import { AccessError, requireAdmin } from "./users";

/*
 * Data access for the sync log screen (spec 06): admin only. `db` is the
 * privileged connection (ADR-0007); ghl_sync_log has RLS on with no policies,
 * so `requireAdmin` here is the access check.
 */

const toEntry = (row: typeof ghlSyncLog.$inferSelect): SyncLogEntry => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Every write and attempt, newest first, filtered by write type and result. */
export async function listSyncLog(
  query: ListSyncLogQuery,
): Promise<SyncLogPage> {
  await requireAdmin();
  const t = ghlSyncLog;
  const rows = await db
    .select()
    .from(t)
    .where(
      and(
        query.writeType && eq(t.writeType, query.writeType),
        query.result && eq(t.result, query.result),
        query.cursor
          ? sql`(${t.createdAt}, ${t.id}) < (select created_at, id from ghl_sync_log where id = ${query.cursor})`
          : undefined,
      ),
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

/** "Retry": re-runs the logged request through the same runner. A succeeded write is left as it is. */
export async function retryWrite(id: string): Promise<SyncLogEntry> {
  await requireAdmin();
  const row = await db.query.ghlSyncLog.findFirst({
    where: eq(ghlSyncLog.id, id),
  });
  if (!row) throw new AccessError("not_found");
  return toEntry(
    await runWrite({
      leadId: row.leadId,
      writeType: row.writeType,
      idempotencyKey: row.idempotencyKey,
      plan: row.payload as WritePlan,
    }),
  );
}
