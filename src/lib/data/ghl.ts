import { inngest } from "@/lib/inngest/client";
import { GHL_IMPORT_REQUESTED } from "@/lib/inngest/functions/ghl-sync";

import { requireAdmin } from "./users";

/*
 * Data access for the GHL connector (spec 06). The work itself runs in the
 * Inngest jobs (lib/inngest/functions/ghl-sync.ts); a person only starts it.
 */

/** Starts the import of every lead in the pipeline. Admin only; safe to run twice. */
export async function requestGhlImport(): Promise<{ eventId: string }> {
  await requireAdmin();
  const { ids } = await inngest.send({ name: GHL_IMPORT_REQUESTED, data: {} });
  return { eventId: ids[0] };
}
