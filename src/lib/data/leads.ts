import { buildSampleLeads, type LeadRecord } from "@/lib/data/fixtures/leads";
import { AccessError, requireUser } from "@/lib/data/users";
import { effectiveVerdict, nextStep } from "@/lib/leads/rules";
import {
  EXITS,
  type LeadDetail,
  type LeadListItem,
  type LeadPage,
  type ListLeadsQuery,
  type LostInput,
  NEEDS,
  type Need,
  type PipelineSummary,
  type QualificationInput,
  type ReviewInput,
  STAGES,
} from "@/lib/leads/schemas";

/*
 * Data access for leads (spec 04, "The sample-data seam"; ADR-0006).
 *
 * THE SEAM. Every exported function starts with the current-user guard and
 * then reads or changes the sample store. Going live means replacing the
 * bodies of the exported functions below with database queries (and adding the
 * Workspace ownership check beside `requireUser`, spec 12), deleting
 * `fixtures/`, and setting SAMPLE_DATA to false. Schemas, Route Handlers,
 * query options, hooks and components do not change.
 *
 * This is the only module, with its tests, that imports the fixtures.
 */

/** Drives the "Sample data" label. False once the bodies below query the database. */
export const SAMPLE_DATA = true;

/**
 * Question 4 (assumed): a suspect's booking is kept until a rep reviews it.
 * The other answer is this one value, plus the copy marked (Q4) in spec 07.
 */
const SUSPECT_BOOKING_KEPT_UNTIL_REVIEW = true;

// ponytail: one in-memory copy per server instance, on globalThis so Route
// Handlers and Server Components (separate bundles) share it. Not durable and
// not shared between instances; it disappears with the fixtures.
const store = globalThis as { __dealwrightSampleLeads?: LeadRecord[] };

function records(): LeadRecord[] {
  store.__dealwrightSampleLeads ??= buildSampleLeads(Date.now());
  return store.__dealwrightSampleLeads;
}

/** Tests only: start again from the fixtures, placed relative to the current time. */
export function resetSampleLeads() {
  store.__dealwrightSampleLeads = undefined;
}

function bookingsOf(record: LeadRecord) {
  if (
    SUSPECT_BOOKING_KEPT_UNTIL_REVIEW ||
    effectiveVerdict(record.verdictRecord) !== "suspect"
  ) {
    return record.bookings;
  }
  return record.bookings.map((booking) =>
    booking.state === "confirmed"
      ? { ...booking, state: "cancelled" as const }
      : booking,
  );
}

function toDetail(record: LeadRecord): LeadDetail {
  const bookings = bookingsOf(record);
  const nextBooking =
    bookings
      .filter((booking) => booking.state === "confirmed")
      .sort((a, b) => a.time.localeCompare(b.time))[0] ?? null;
  // A copy, so a caller can never change the store through what it was given.
  return structuredClone({
    ...record,
    bookings,
    verdict: effectiveVerdict(record.verdictRecord),
    nextBooking,
  });
}

function toListItem(lead: LeadDetail): LeadListItem {
  const { id, name, company, email, stage, exit, status, verdict, owner } =
    lead;
  return {
    id,
    name,
    company,
    email,
    stage,
    exit,
    status,
    verdict,
    owner,
    nextBooking: lead.nextBooking,
    createdAt: lead.createdAt,
  };
}

/** The calendar day of a moment in the viewer's time zone, as YYYY-MM-DD. */
function localDay(time: string | number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
}

/** The four "needs you" definitions (spec 05; proposed). */
function needsOf(lead: LeadDetail, today: string, timeZone: string): Need[] {
  const needs: Need[] = [];
  if (lead.exit) return needs;
  if (lead.verdict === "suspect") needs.push("suspects");
  if (
    lead.bookings.some(
      (booking) =>
        booking.state === "confirmed" &&
        localDay(booking.time, timeZone) === today,
    )
  ) {
    needs.push("calls_today");
  }
  if (
    (lead.stage === "qualified" || lead.stage === "review_booked") &&
    (!lead.proposal || lead.proposal.status === "draft")
  ) {
    needs.push("proposals");
  }
  if (lead.stage === "won" && lead.invoice?.status === "draft") {
    needs.push("invoices");
  }
  return needs;
}

function find(leadId: string): LeadRecord {
  const record = records().find((lead) => lead.id === leadId);
  if (!record) throw new AccessError("not_found");
  return record;
}

/** One entry at the top of the timeline; the timeline is append-only (spec 09). */
function addActivity(
  record: LeadRecord,
  actorName: string,
  type: string,
  detail: string,
  time: string,
) {
  record.activities.unshift({
    id: `${record.id}-a${record.activities.length + 1}`,
    actor: { kind: "user", name: actorName },
    type,
    detail,
    time,
  });
  record.updatedAt = time;
}

function cancelUpcomingBookings(record: LeadRecord) {
  for (const booking of record.bookings) {
    if (booking.state === "confirmed") booking.state = "cancelled";
  }
}

// ---------------------------------------------------------------------------
// The functions whose bodies change when real data arrives.
// ---------------------------------------------------------------------------

/** A page of list items for the Pipeline and the suspect queue. */
export async function listLeads(query: ListLeadsQuery): Promise<LeadPage> {
  await requireUser();

  const today = localDay(Date.now(), query.tz);
  const text = query.q?.toLowerCase();
  const matches = records()
    .map(toDetail)
    .map((lead) => ({ lead, needs: needsOf(lead, today, query.tz) }))
    .filter(({ lead, needs }) => {
      // "open" is every lead still in the pipeline; an exit tab holds the
      // leads that took it; a stage tab holds the leads still in that stage.
      const inTab =
        query.tab === "open"
          ? !lead.exit
          : lead.exit
            ? lead.exit === query.tab
            : lead.stage === query.tab;
      if (!inTab) return false;
      if (query.verdict && lead.verdict !== query.verdict) return false;
      if (query.owner && lead.owner.id !== query.owner) return false;
      if (query.needs && !needs.includes(query.needs)) return false;
      if (
        text &&
        ![lead.name, lead.company, lead.email].some((field) =>
          field?.toLowerCase().includes(text),
        )
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) =>
      // The suspect queue is oldest first, so nobody waits longest by accident.
      query.needs === "suspects"
        ? a.lead.createdAt.localeCompare(b.lead.createdAt)
        : // Otherwise: leads that need the rep first, then most recently updated.
          Number(b.needs.length > 0) - Number(a.needs.length > 0) ||
          b.lead.updatedAt.localeCompare(a.lead.updatedAt),
    );

  // ponytail: the cursor is an offset, which is exact while the data stands
  // still. Use a keyset cursor (updatedAt, id) when this becomes a query.
  const start = Math.max(0, Number.parseInt(query.cursor ?? "0", 10) || 0);
  const end = start + query.limit;
  return {
    items: matches.slice(start, end).map(({ lead }) => toListItem(lead)),
    nextCursor: end < matches.length ? String(end) : null,
    total: matches.length,
  };
}

/** Counts per stage and exit, the four "needs you" counts and the owners. */
export async function getPipelineSummary(query: {
  tz: string;
}): Promise<PipelineSummary> {
  await requireUser();

  const today = localDay(Date.now(), query.tz);
  const zero = <K extends string>(keys: readonly K[]) =>
    Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  const summary: PipelineSummary = {
    open: 0,
    stages: zero(STAGES),
    exits: zero(EXITS),
    needs: zero(NEEDS),
    owners: [],
  };
  const owners = new Map<string, string>();

  for (const lead of records().map(toDetail)) {
    owners.set(lead.owner.id, lead.owner.name);
    if (lead.exit) {
      summary.exits[lead.exit] += 1;
      continue;
    }
    summary.open += 1;
    summary.stages[lead.stage] += 1;
    for (const need of needsOf(lead, today, query.tz)) summary.needs[need] += 1;
  }
  summary.owners = [...owners]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return summary;
}

/** One lead in detail. */
export async function getLead(leadId: string): Promise<LeadDetail> {
  await requireUser();
  return toDetail(find(leadId));
}

/** Records a rep's decision on a suspect (spec 07). */
export async function reviewSuspect(
  leadId: string,
  input: ReviewInput,
): Promise<LeadDetail> {
  const user = await requireUser();
  const record = find(leadId);
  if (!nextStep(toDetail(record)).canReview || !record.verdictRecord) {
    throw new AccessError("conflict");
  }

  // The reviewer and the time come from the session and the clock, never from input.
  const reviewer = `${user.firstName} ${user.lastName}`;
  const time = new Date().toISOString();
  record.verdictRecord.reviewOutcome = input.outcome;
  record.verdictRecord.reviewedBy = reviewer;
  record.verdictRecord.reviewedAt = time;

  if (input.outcome === "cleared") {
    // The status a valid lead would have. "Needs a decision" stands in for
    // "valid, call booked, deck not generated yet" (spec 07, question 8).
    const booked = record.bookings.some(
      (booking) => booking.state === "confirmed",
    );
    record.status = booked ? "needs_decision" : "drip_chasing";
    addActivity(
      record,
      reviewer,
      "Suspect reviewed",
      "Cleared as valid.",
      time,
    );
  } else {
    record.exit = "spam";
    record.status = "removed";
    cancelUpcomingBookings(record);
    addActivity(record, reviewer, "Suspect reviewed", "Marked as spam.", time);
  }
  return toDetail(record);
}

/** Records the decision after the discovery call (spec 06). */
export async function setQualification(
  leadId: string,
  input: QualificationInput,
): Promise<LeadDetail> {
  const user = await requireUser();
  const record = find(leadId);
  if (!nextStep(toDetail(record)).canQualify) throw new AccessError("conflict");

  const actor = `${user.firstName} ${user.lastName}`;
  const time = new Date().toISOString();
  if (input.decision === "qualified") {
    record.stage = "qualified";
    record.status = "qualified";
    addActivity(
      record,
      actor,
      "Qualified",
      "Marked qualified after the discovery call.",
      time,
    );
  } else {
    record.exit = "lost";
    record.status = "not_a_fit";
    addActivity(
      record,
      actor,
      "Not qualified",
      "Not qualified after the discovery call.",
      time,
    );
  }
  return toDetail(record);
}

/** Marks a lead lost, with an optional reason (spec 06). */
export async function markLost(
  leadId: string,
  input: LostInput,
): Promise<LeadDetail> {
  const user = await requireUser();
  const record = find(leadId);
  if (!nextStep(toDetail(record)).canMarkLost)
    throw new AccessError("conflict");

  record.exit = "lost";
  record.status = "removed";
  addActivity(
    record,
    `${user.firstName} ${user.lastName}`,
    "Marked lost",
    input.reason ? `Reason: ${input.reason}` : "No reason given.",
    new Date().toISOString(),
  );
  return toDetail(record);
}

/** Marks a lead spam and cancels its upcoming booking (spec 06; question 5, assumed). */
export async function markSpam(leadId: string): Promise<LeadDetail> {
  const user = await requireUser();
  const record = find(leadId);
  if (!nextStep(toDetail(record)).canMarkSpam)
    throw new AccessError("conflict");

  record.exit = "spam";
  record.status = "removed";
  cancelUpcomingBookings(record);
  addActivity(
    record,
    `${user.firstName} ${user.lastName}`,
    "Marked spam",
    "Removed from the pipeline as spam.",
    new Date().toISOString(),
  );
  return toDetail(record);
}
