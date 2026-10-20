import { eq, or } from "drizzle-orm";
import type { GetStepTools } from "inngest";

import { db } from "@/db/client";
import { leadStatusEvents, leads, profiles } from "@/db/schema";
import { inngest } from "@/lib/inngest/client";
import {
  type GhlCursor,
  type GhlOpportunity,
  getContact,
  type LeadCopy,
  leadFromGhl,
  searchPipelineOpportunities,
} from "@/lib/services/ghl";

/*
 * The import and the nightly reconcile (spec 06, "The copy of each lead";
 * ADR-0009). Both page through the pipeline and bring each lead's copy in step
 * with GHL; each change is one lead_status_events row. Read-only on GHL.
 *
 * These run as the system, not as a person: there is no session to guard. The
 * person who starts an import is checked by `requestGhlImport` (data/ghl.ts).
 * `db` is the privileged connection (ADR-0007): RLS is default-deny for every
 * Supabase role, so a job that writes leads can only run on it.
 */

export const GHL_IMPORT_REQUESTED = "ghl/import.requested";

type Actor = "import" | "reconcile";
type Outcome = "created" | "updated" | "unchanged" | "skipped";

/** The reconcile leaves closed leads alone (spec 06). */
const CLOSED = new Set(["Lead Won", "Lead Lost"]);

const same = (a: unknown, b: unknown) =>
  a instanceof Date && b instanceof Date
    ? a.getTime() === b.getTime()
    : a === b;

/** The profile mapped to a GHL user (profiles.ghl_user_id), or null. */
async function profileFor(ghlUserId: string | null): Promise<string | null> {
  if (!ghlUserId) return null;
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.ghlUserId, ghlUserId),
    columns: { id: true },
  });
  return profile?.id ?? null;
}

/**
 * Brings one lead in step with its opportunity. The lead is found by
 * opportunity, or by contact (a contact can arrive before its opportunity);
 * a soft-deleted lead is never brought back. Unchanged writes nothing.
 */
export async function syncOpportunity(
  opportunity: GhlOpportunity,
  actor: Actor,
): Promise<Outcome> {
  const existing = await db.query.leads.findFirst({
    where: or(
      eq(leads.ghlOpportunityId, opportunity.id),
      eq(leads.ghlContactId, opportunity.contactId),
    ),
  });
  if (existing?.deletedAt) return "skipped";
  if (actor === "reconcile" && existing?.stage && CLOSED.has(existing.stage)) {
    return "skipped";
  }

  const copy = leadFromGhl(
    opportunity,
    await getContact(opportunity.contactId),
  );
  const changed = existing
    ? (Object.keys(copy) as (keyof LeadCopy)[]).filter(
        (key) => !same(existing[key], copy[key]),
      )
    : [];
  if (existing && !changed.length) return "unchanged";

  // assigned_to follows GHL's assigned user only when that user changes, so a
  // rep assigned in the app is not undone by every reconcile (schema draft Q6).
  const reassigned = !existing || changed.includes("ghlAssignedUserId");
  const assignment = reassigned
    ? { assignedTo: await profileFor(copy.ghlAssignedUserId) }
    : {};

  await db.transaction(async (tx) => {
    const [lead] = existing
      ? await tx
          .update(leads)
          .set({ ...copy, ...assignment })
          .where(eq(leads.id, existing.id))
          .returning({ id: leads.id })
      : await tx
          .insert(leads)
          .values({ ...copy, ...assignment })
          .returning({ id: leads.id });
    await tx.insert(leadStatusEvents).values({
      leadId: lead.id,
      fromStage: existing?.stage ?? null,
      toStage: copy.stage,
      fromStatus: existing?.leadStatus ?? null,
      toStatus: copy.leadStatus,
      actor,
      // Field names only, never values: the timeline is not a copy of the contact.
      note: existing ? `corrected: ${changed.join(", ")}` : "imported",
    });
  });
  return existing ? "updated" : "created";
}

export type SyncCounts = Record<Outcome, number>;
const noCounts = (): SyncCounts => ({
  created: 0,
  updated: 0,
  unchanged: 0,
  skipped: 0,
});

/** One page of the pipeline. Safe to repeat: a retried page re-reads and changes nothing twice. */
export async function syncPage(actor: Actor, cursor: GhlCursor | null) {
  const { opportunities, next } = await searchPipelineOpportunities(cursor);
  const counts = noCounts();
  // ponytail: one contact read per opportunity, in sequence; batch or parallelise if the pipeline outgrows a night.
  for (const opportunity of opportunities) {
    counts[await syncOpportunity(opportunity, actor)]++;
  }
  return { next, counts };
}

/** Every page, one step each, so a failure retries only its page. */
async function syncPipeline(
  actor: Actor,
  step: GetStepTools<typeof inngest>,
): Promise<SyncCounts> {
  const totals = noCounts();
  let cursor: GhlCursor | null = null;
  for (let page = 0; ; page++) {
    const result = await step.run(`page ${page}`, () =>
      syncPage(actor, cursor),
    );
    for (const key of Object.keys(totals) as Outcome[]) {
      totals[key] += result.counts[key];
    }
    if (!result.next) return totals;
    cursor = result.next;
  }
}

/** The admin-run import (spec 06): every opportunity in the pipeline, upserted by ghl_opportunity_id. */
export const ghlImport = inngest.createFunction(
  {
    id: "ghl-import",
    concurrency: { limit: 1 },
    triggers: { event: GHL_IMPORT_REQUESTED },
  },
  ({ step }) => syncPipeline("import", step),
);

/** The nightly reconcile: corrects every lead not yet Lead Won or Lead Lost. 08:00 UTC is 03:00 or 04:00 in New York. */
export const ghlReconcile = inngest.createFunction(
  {
    id: "ghl-reconcile",
    concurrency: { limit: 1 },
    triggers: { cron: "0 8 * * *" },
  },
  ({ step }) => syncPipeline("reconcile", step),
);
