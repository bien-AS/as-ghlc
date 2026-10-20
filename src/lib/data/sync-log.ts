import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { ghlSyncLog } from "@/db/schema";
import { runWrite, type WritePlan } from "@/lib/services/ghl/runner";
import {
  canRetry,
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

/**
 * "Retry": re-runs the logged request through the same runner. Refused
 * ("conflict") unless the write failed, or has been pending past
 * STALE_PENDING_MS (`canRetry`), and is still the latest of its type for its
 * lead: re-sending an older decision would move GHL back over the newer one
 * and can fire its email again (W3).
 *
 * ponytail: a decision logged between this check and the send is not seen;
 * take a per-lead advisory lock here and in runWrite if that window matters.
 */
export async function retryWrite(id: string): Promise<SyncLogEntry> {
  await requireAdmin();
  const row = await db.query.ghlSyncLog.findFirst({
    where: eq(ghlSyncLog.id, id),
  });
  if (!row) throw new AccessError("not_found");
  if (!canRetry(row)) throw new AccessError("conflict");
  const newer = await db.query.ghlSyncLog.findFirst({
    columns: { id: true },
    where: and(
      // A row whose lead was deleted (null) counts every other such row as
      // its lead's: refusing too often is safe, re-sending a stale write is not.
      sql`${ghlSyncLog.leadId} is not distinct from ${row.leadId}`,
      eq(ghlSyncLog.writeType, row.writeType),
      // In SQL, at the column's microseconds: a JS Date would cut them to ms.
      sql`${ghlSyncLog.createdAt} > (select created_at from ghl_sync_log where id = ${row.id})`,
    ),
  });
  if (newer) throw new AccessError("conflict");
  return toEntry(
    await runWrite({
      leadId: row.leadId,
      writeType: row.writeType,
      idempotencyKey: row.idempotencyKey,
      plan: row.payload as WritePlan,
    }),
  );
}
