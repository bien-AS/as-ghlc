import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { leads, webhookEvents } from "@/db/schema";
import { inngest } from "@/lib/inngest/client";
import { findContactOpportunity, ghlConfig } from "@/lib/services/ghl";

import { type Booking, syncOpportunity } from "./ghl-sync";

/*
 * Events in (spec 06; ADR-0009). POST /api/webhooks/ghl verifies and records
 * each of the four workflow webhooks, then sends GHL_WEBHOOK_RECEIVED; this job
 * reads the contact's opportunity back from GHL (read-only) and applies it.
 *
 * Runs as the system, like the import: no session to guard. `db` is the
 * privileged connection (ADR-0007); RLS is default-deny for every Supabase role.
 */

export const GHL_WEBHOOK_RECEIVED = "ghl/webhook.received";
/** Spec 08 consumes it; the id makes a repeat within 24 hours a no-op in Inngest. */
export const LEAD_VALIDATION_REQUESTED = "lead/validation.requested";

const ghlId = z.string().min(1);
const contactEvent = z.object({ webhookId: ghlId, contact_id: ghlId });
const appointmentEvent = contactEvent.extend({
  calendar: z.object({ id: ghlId, startTime: ghlId.pipe(z.coerce.date()) }),
});

/**
 * assumed: the field paths each webhook is relied on to carry, per event type
 * (the `event` query parameter of the URL Lee configures). Unconfirmed until
 * Lee points a workflow at a preview (spec 06 open question 7); fixtures in
 * ghl-webhook.fixtures.ts. The rest of the payload is kept, not read: the job
 * reads the contact and opportunity back from GHL.
 */
export const ASSUMED_PAYLOADS = {
  /** webhookId, contact_id */
  contact_created: contactEvent,
  /** webhookId, contact_id, calendar.id, calendar.startTime */
  appointment_booked: appointmentEvent,
  /** webhookId, contact_id, calendar.id, calendar.startTime */
  appointment_cancelled: appointmentEvent,
  /** webhookId, contact_id, calendar.id, calendar.startTime */
  appointment_no_show: appointmentEvent,
  /** webhookId, contact_id */
  stage_changed: contactEvent,
};
export const webhookType = z.enum(
  Object.keys(ASSUMED_PAYLOADS) as (keyof typeof ASSUMED_PAYLOADS)[],
);
export type WebhookType = z.infer<typeof webhookType>;

/** Records a received webhook. Null when (provider, event_id) is already recorded: a duplicate. */
export async function recordWebhookEvent(
  event: Omit<typeof webhookEvents.$inferInsert, "provider">,
): Promise<string | null> {
  const [row] = await db
    .insert(webhookEvents)
    .values({ provider: "ghl", ...event })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  return row?.id ?? null;
}

/** Drops an event that could not be queued, so GHL's retry (after a 429) is not taken for a duplicate. */
export const forgetWebhookEvent = (id: string) =>
  db.delete(webhookEvents).where(eq(webhookEvents.id, id));

const setOutcome = (id: string, outcome: string) =>
  db.update(webhookEvents).set({ outcome }).where(eq(webhookEvents.id, id));

const BOOKING_STATUS = {
  appointment_booked: "booked",
  appointment_cancelled: "cancelled",
  appointment_no_show: "no_show",
} as const;

/** Which calendar decides discovery or proposal review; another calendar changes no booking. */
function bookingFor(type: WebhookType, payload: unknown): Booking {
  if (!(type in BOOKING_STATUS)) return {};
  const status = BOOKING_STATUS[type as keyof typeof BOOKING_STATUS];
  const { id, startTime } = appointmentEvent.parse(payload).calendar;
  const { calendars } = ghlConfig();
  if (id === calendars.discovery) {
    return { discoveryBookingAt: startTime, discoveryBookingStatus: status };
  }
  if (id === calendars.proposalReview) {
    return { reviewBookingAt: startTime, reviewBookingStatus: status };
  }
  return {};
}

/**
 * Applies one recorded event and writes its outcome. Throws (so Inngest
 * retries) while the contact has no opportunity in the pipeline yet.
 */
export async function applyWebhookEvent(id: string): Promise<string> {
  const row = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.id, id),
  });
  if (!row) return "missing";
  const type = webhookType.parse(row.type);
  const { contact_id } = ASSUMED_PAYLOADS[type].parse(row.payload);

  const opportunity = await findContactOpportunity(contact_id);
  if (!opportunity) {
    throw new Error(
      `Contact ${contact_id} has no opportunity in the pipeline yet`,
    );
  }
  const outcome = await syncOpportunity(
    opportunity,
    "webhook",
    bookingFor(type, row.payload),
  );

  // Every contact-created event, not only one that created the lead: another
  // event for the same contact may have been applied first.
  if (type === "contact_created" && outcome !== "skipped") {
    const lead = await db.query.leads.findFirst({
      where: eq(leads.ghlContactId, contact_id),
      columns: { id: true },
    });
    if (lead) {
      await inngest.send({
        id: `validation-${lead.id}`,
        name: LEAD_VALIDATION_REQUESTED,
        data: { leadId: lead.id },
      });
    }
  }
  await setOutcome(id, outcome);
  return outcome;
}

/** Records why an event failed after its retries. GhlError messages never hold the token. */
export const markWebhookFailed = (id: string, error: { message: string }) =>
  setOutcome(id, `failed: ${error.message}`.slice(0, 500));

export const ghlWebhook = inngest.createFunction(
  {
    id: "ghl-webhook",
    // One contact at a time, so two events for a new contact cannot both create its lead.
    concurrency: { key: "event.data.contactId", limit: 1 },
    triggers: { event: GHL_WEBHOOK_RECEIVED },
    onFailure: ({ event, error }) =>
      markWebhookFailed(event.data.event.data.webhookEventId, error),
  },
  ({ event, step }) =>
    step.run("apply", () => applyWebhookEvent(event.data.webhookEventId)),
);
