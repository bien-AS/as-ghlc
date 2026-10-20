import { asc } from "drizzle-orm";

import { db } from "@/db/client";
import { statusDefs } from "@/db/schema";
import { requireProfile } from "@/lib/data/users";
import type { StatusDef } from "@/lib/leads/schemas";

/*
 * Data access for GHL's Lead Status picklist (status_defs, spec 03), seeded by
 * drizzle/0002_webhook_events_and_status_defs.sql. Every signed-in, active
 * person reads it: it feeds the lead list's group filter and Change status.
 */

/** The picklist, in GHL's order. */
export async function listStatusDefs(): Promise<StatusDef[]> {
  await requireProfile();
  const rows = await db
    .select({
      value: statusDefs.value,
      group: statusDefs.groupName,
      position: statusDefs.position,
      tone: statusDefs.tone,
    })
    .from(statusDefs)
    .orderBy(asc(statusDefs.position));
  return rows.map((row) => ({ ...row, tone: row.tone as StatusDef["tone"] }));
}
