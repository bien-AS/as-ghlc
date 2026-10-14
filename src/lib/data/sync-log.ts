import { sampleStore } from "@/lib/data/sample";
import { AccessError } from "@/lib/data/users";
import { getViewer } from "@/lib/data/viewer";
import { can } from "@/lib/roles";
import {
  SYNC_LOG_PAGE_SIZE,
  type SyncEntry,
  type SyncLog,
  type SyncWriteInput,
} from "@/lib/sync/schemas";

/*
 * Data access for the GHL sync log (build packet S6; ADR-0006).
 *
 * THE SEAM. `recordSyncWrite` is the one write path to the CRM. Today it only
 * records: nothing is sent anywhere. Going live means sending the write to GHL
 * from here (through an Inngest function, at-least-once), keeping the
 * idempotency check, and writing the outcome to the ghl_sync_log table. The
 * callers, the screen and the Route Handler do not change. Nothing else may
 * call the GHL API.
 */

const store = sampleStore("sync-log", () => ({
  entries: [] as SyncEntry[],
  /** Idempotency keys already sent. */
  sent: new Set<string>(),
}));

/**
 * Records a write to the CRM, once per idempotency key. A second write with a
 * key already sent is logged as `skipped_duplicate` and not sent again, which
 * is what keeps a client from getting two emails when a stage is written twice.
 *
 * Internal: called by other data-access functions after their own guard, never
 * by a Route Handler.
 */
export function recordSyncWrite(input: SyncWriteInput): SyncEntry {
  const { entries, sent } = store();
  const duplicate = sent.has(input.idempotencyKey);
  sent.add(input.idempotencyKey);
  const entry: SyncEntry = {
    ...input,
    id: `sync-${entries.length + 1}`,
    at: new Date().toISOString(),
    outcome: duplicate ? "skipped_duplicate" : "sent",
  };
  entries.unshift(entry);
  return entry;
}

/** The log, newest first. For people who manage the CRM connection only. */
export async function listSyncLog(): Promise<SyncLog> {
  const { role } = await getViewer();
  if (!can(role, "view_logs")) throw new AccessError("forbidden");
  return { items: store().entries.slice(0, SYNC_LOG_PAGE_SIZE) };
}
