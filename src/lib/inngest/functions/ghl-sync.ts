import { eq, or } from "drizzle-orm";
import type { GetStepTools } from "inngest";

import { db } from "@/db/client";
import { leadStatusEvents, leads, profiles, statusDefs } from "@/db/schema";
import { inngest } from "@/lib/inngest/client";
import {
  type GhlCursor,
  type GhlOpportunity,
  getContact,
  ghlConfig,
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
/** Spec 08 consumes it; the id makes a repeat within 24 hours a no-op in Inngest. */
export const LEAD_VALIDATION_REQUESTED = "lead/validation.requested";

/**
 * assumed: the import (the initial bulk load of leads GHL already holds) does
 * not send its leads to validation; a lead the app first sees by webhook or
 * reconcile does. Lee confirms whether imported leads are validated.
 */
const VALIDATE_IMPORTED_LEADS = false;

type Actor = "import" | "reconcile" | "webhook";
export type Outcome = "created" | "updated" | "unchanged" | "skipped";

/** The reconcile leaves leads closed in GHL alone (spec 06). */
const CLOSED = ["Lead Won", "Lead Lost"] as const;

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

/** The booking columns an appointment webhook sets; GHL owns bookings (ADR-0009). */
export type Booking = Partial<
  Pick<
    typeof leads.$inferInsert,
    | "discoveryBookingAt"
    | "discoveryBookingStatus"
    | "reviewBookingAt"
    | "reviewBookingStatus"
  >
>;

/** Lead Status as GHL holds it, or null (logged) when status_defs does not know it: the column is a foreign key. */
async function knownStatus(value: string | null): Promise<string | null> {
  if (value === null) return null;
  const known = await db.query.statusDefs.findFirst({
    where: eq(statusDefs.value, value),
    columns: { value: true },
  });
  if (!known) console.warn(`GHL Lead Status "${value}" is not in status_defs`);
  return known ? value : null;
}

/**
 * Brings one lead in step with its opportunity, plus any booking change a
 * webhook carries. The lead is found by opportunity, or by contact (a contact
 * can arrive before its opportunity); a soft-deleted lead is never brought
 * back. Unchanged writes nothing.
 */
export async function syncOpportunity(
  opportunity: GhlOpportunity,
  actor: Actor,
  booking: Booking = {},
): Promise<Outcome> {
  const existing = await db.query.leads.findFirst({
    where: or(
      eq(leads.ghlOpportunityId, opportunity.id),
      eq(leads.ghlContactId, opportunity.contactId),
    ),
  });
  if (existing?.deletedAt) return "skipped";
  // By GHL's stage, not the app's: a lead GHL reopened is corrected, and so is
  // one GHL closed while the app still holds it open (check 4).
  const closed = CLOSED.find(
    (stage) => ghlConfig().stages[stage] === opportunity.pipelineStageId,
  );
  if (
    actor === "reconcile" &&
    closed &&
    (!existing || existing.stage === closed)
  ) {
    return "skipped";
  }

  const ghlCopy = leadFromGhl(
    opportunity,
    await getContact(opportunity.contactId),
  );
  const copy: LeadCopy & Booking = {
    ...ghlCopy,
    leadStatus: await knownStatus(ghlCopy.leadStatus),
    ...booking,
  };
  const changed = existing
    ? (Object.keys(copy) as (keyof typeof copy)[]).filter(
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
      note: existing
        ? `corrected: ${changed.join(", ")}`
        : actor === "webhook"
          ? "created"
          : "imported",
    });
    // Inside the transaction, so a failed send rolls the lead back and the retry creates it again.
    if (!existing && (actor !== "import" || VALIDATE_IMPORTED_LEADS)) {
      await inngest.send({
        id: `validation-${lead.id}`,
        name: LEAD_VALIDATION_REQUESTED,
        data: { leadId: lead.id },
      });
    }
  });
  return existing ? "updated" : "created";
}

export type SyncCounts = Record<Outcome | "failed", number>;
const noCounts = (): SyncCounts => ({
  created: 0,
  updated: 0,
  unchanged: 0,
  skipped: 0,
  failed: 0,
});

/**
 * One page of the pipeline. Safe to repeat: a retried page re-reads and changes
 * nothing twice. One opportunity that fails (a stage GHL_IDS does not name, a
 * contact GHL cannot return) is counted and named, and the page goes on.
 */
export async function syncPage(actor: Actor, cursor: GhlCursor | null) {
  const { opportunities, next } = await searchPipelineOpportunities(cursor);
  const counts = noCounts();
  const failedIds: string[] = [];
  // ponytail: one contact read per opportunity, in sequence; batch or parallelise if the pipeline outgrows a night.
  for (const opportunity of opportunities) {
    try {
      counts[await syncOpportunity(opportunity, actor)]++;
    } catch (error) {
      counts.failed++;
      failedIds.push(opportunity.id);
      // GhlError messages never hold the token.
      console.error(
        `GHL ${actor}: opportunity ${opportunity.id} failed: ${(error as Error).message}`,
      );
    }
  }
  return { next, counts, failedIds };
}

/** Every page, one step each, so a failure retries only its page. */
async function syncPipeline(
  actor: Actor,
  step: GetStepTools<typeof inngest>,
): Promise<SyncCounts & { failedIds: string[] }> {
  const totals = noCounts();
  const failedIds: string[] = [];
  let cursor: GhlCursor | null = null;
  for (let page = 0; ; page++) {
    const result = await step.run(`page ${page}`, () =>
      syncPage(actor, cursor),
    );
    for (const key of Object.keys(totals) as (keyof SyncCounts)[]) {
      totals[key] += result.counts[key];
    }
    failedIds.push(...result.failedIds);
    if (!result.next) return { ...totals, failedIds };
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
