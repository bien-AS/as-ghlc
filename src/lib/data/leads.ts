import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  notExists,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";

import { db } from "@/db/client";
import {
  ghlSyncLog,
  invoices,
  leadStatusEvents,
  leads,
  profiles,
  proposals,
  statusDefs,
  validationRuns,
} from "@/db/schema";
import { SAMPLE_DATA } from "@/lib/data/sample";
import {
  AccessError,
  leadScope,
  type Profile,
  requireAdmin,
  requireProfile,
} from "@/lib/data/users";
import { nextStep } from "@/lib/leads/rules";
import type {
  Activity,
  ArchiveInput,
  AssignInput,
  Booking,
  Exit,
  LeadDetail,
  LeadListItem,
  LeadPage,
  LeadStatus,
  ListLeadsQuery,
  Need,
  PipelineSummary,
  PipelineTab,
  QualificationInput,
  ReviewInput,
  Stage,
  StatusInput,
  SyncEntry,
} from "@/lib/leads/schemas";
import { EXITS, NEEDS, STAGES, UNASSIGNED } from "@/lib/leads/schemas";
import { runWrite, type Write } from "@/lib/services/ghl/runner";
import {
  markSpamWrite,
  qualificationWrite,
  validationVerdictWrite,
} from "@/lib/services/ghl/writes";

/*
 * Data access for leads (spec 07), on the `leads` table the GHL connector
 * keeps in step (spec 06, ADR-0009).
 *
 * THE GUARD. Every exported function starts with `requireProfile` (or
 * `requireAdmin`), and every lead query includes `leadScope(profile)`: an admin
 * reaches every lead, a rep only the leads assigned to them. A lead outside
 * the scope answers `not_found`, as if it did not exist. Anything that belongs
 * to a lead (its events, its sync log, its validation runs) is read only after
 * the lead itself was found through the scope.
 *
 * `db` is the privileged connection (ADR-0007): RLS is on with no policies and
 * this connection bypasses it, so these guards are the access check.
 */

export { SAMPLE_DATA };

type DbStage = NonNullable<typeof leads.$inferSelect.stage>;
type LeadRow = typeof leads.$inferSelect;

/** GHL's stages as the contract's stages and exits (Lead Lost and Nurturing leave the pipeline). */
const STAGE_OF: Record<DbStage, Stage | Exit> = {
  "New Lead": "new",
  "Discovery Call Booked": "discovery_booked",
  Qualified: "qualified",
  "Proposal Review Booked": "review_booked",
  "Proposal Sent": "proposal_sent",
  "Lead Won": "won",
  "Lead Lost": "lost",
  Nurturing: "nurture",
};
const DB_STAGE = Object.fromEntries(
  Object.entries(STAGE_OF).map(([db, slug]) => [slug, db]),
) as Record<Stage | "lost" | "nurture", DbStage>;
const EXIT_STAGES: DbStage[] = ["Lead Lost", "Nurturing"];

/**
 * Change status (spec 07 open question 2, ASSUMED until Lee answers): the Lead
 * Status values a rep may set by hand. Empty, so only admins change status.
 * GHL's workflows also set Lead Status and own it (ADR-0009), so the next sync
 * may overwrite a value set here; nothing is written to GHL for it (spec 06
 * has no such write).
 */
export const REP_SETTABLE_STATUSES: readonly string[] = [];

// --- reading rows ---------------------------------------------------------------

const notSpam = sql`${leads.verdict} is distinct from 'spam'`;
/** Still in the pipeline: not spam, not Lead Lost or Nurturing. */
const isOpen = and(
  notSpam,
  or(isNull(leads.stage), notInArray(leads.stage, EXIT_STAGES)),
) as SQL;

/** A booked call's time, or null: the column only when its status is booked. */
const booked = (at: PgColumn, status: PgColumn) =>
  sql`case when ${status} = 'booked' then ${at} end`;
const discovery = booked(
  leads.discoveryBookingAt,
  leads.discoveryBookingStatus,
);
const review = booked(leads.reviewBookingAt, leads.reviewBookingStatus);
/** The earliest booked call still to come (`least` skips nulls). */
const nextBookingAt = sql`least(
  case when ${discovery} >= now() then ${discovery} end,
  case when ${review} >= now() then ${review} end)`;

const sameDay = (at: SQL, tz: string) =>
  sql`(${at} at time zone ${tz})::date = (now() at time zone ${tz})::date`;

/** The four "needs you" filters of the lead list (spec 05). Each implies the lead is open. */
function needsCondition(need: Need, tz: string): SQL {
  switch (need) {
    case "suspects":
      return eq(leads.verdict, "suspect");
    case "calls_today":
      return or(sameDay(discovery, tz), sameDay(review, tz)) as SQL;
    case "proposals":
      return and(
        inArray(leads.stage, ["Qualified", "Proposal Review Booked"]),
        notExists(
          db
            .select({ one: sql`1` })
            .from(proposals)
            .where(
              and(
                eq(proposals.leadId, leads.id),
                notInArray(proposals.status, ["generating", "draft", "failed"]),
              ),
            ),
        ),
      ) as SQL;
    case "invoices":
      return and(
        eq(leads.stage, "Lead Won"),
        exists(
          db
            .select({ one: sql`1` })
            .from(invoices)
            .innerJoin(proposals, eq(proposals.id, invoices.proposalId))
            .where(
              and(eq(proposals.leadId, leads.id), eq(invoices.status, "draft")),
            ),
        ),
      ) as SQL;
  }
}

function tabCondition(tab: PipelineTab): SQL {
  if (tab === "open") return isOpen;
  if (tab === "spam") return eq(leads.verdict, "spam");
  return and(notSpam, eq(leads.stage, DB_STAGE[tab])) as SQL;
}

/** The columns a list row reads: the lead, its rep and its Lead Status. */
const ROW = {
  lead: leads,
  owner: {
    id: profiles.id,
    firstName: profiles.firstName,
    lastName: profiles.lastName,
  },
  status: {
    value: statusDefs.value,
    group: statusDefs.groupName,
    tone: statusDefs.tone,
  },
};

/** Leads in the profile's scope, with their rep and Lead Status, matching `where`. */
const scopedRows = (profile: Profile, ...where: (SQL | undefined)[]) =>
  db
    .select(ROW)
    .from(leads)
    .leftJoin(profiles, eq(profiles.id, leads.assignedTo))
    .leftJoin(statusDefs, eq(statusDefs.value, leads.leadStatus))
    .where(and(leadScope(profile), ...where));

type Row = {
  lead: LeadRow;
  owner: { id: string; firstName: string; lastName: string } | null;
  status: { value: string; group: string; tone: string } | null;
};

const personName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`.trim();

export const leadName = (
  lead: Pick<LeadRow, "firstName" | "lastName" | "email">,
) =>
  [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
  lead.email ||
  "Unnamed lead";

const iso = (time: Date | null) => time?.toISOString() ?? null;

/**
 * A booking's state. ASSUMED: GHL's webhooks report booked, no-show and
 * cancelled, never "showed", so a booked call whose time has passed counts as
 * held until a no-show says otherwise (spec 06 check 3).
 */
function bookingState(
  status: NonNullable<LeadRow["discoveryBookingStatus"]>,
  at: Date,
): Booking["state"] {
  if (status === "booked") return at > new Date() ? "confirmed" : "completed";
  return status === "showed" ? "completed" : status;
}

function bookingsOf(lead: LeadRow): Booking[] {
  const all: Booking[] = [];
  if (lead.discoveryBookingAt && lead.discoveryBookingStatus) {
    all.push({
      kind: "discovery",
      time: lead.discoveryBookingAt.toISOString(),
      state: bookingState(lead.discoveryBookingStatus, lead.discoveryBookingAt),
    });
  }
  if (lead.reviewBookingAt && lead.reviewBookingStatus) {
    all.push({
      kind: "proposal_review",
      time: lead.reviewBookingAt.toISOString(),
      state: bookingState(lead.reviewBookingStatus, lead.reviewBookingAt),
    });
  }
  return all.sort((a, b) => a.time.localeCompare(b.time));
}

const toSyncEntry = (row: typeof ghlSyncLog.$inferSelect): SyncEntry => ({
  id: row.id,
  writeType: row.writeType,
  result: row.result,
  time: row.updatedAt.toISOString(),
  lastError: row.lastError,
});

function toListItem(
  { lead, owner, status }: Row,
  lastSync: SyncEntry | null,
): LeadListItem {
  const mapped = lead.stage ? STAGE_OF[lead.stage] : null;
  const exit: Exit | null =
    lead.verdict === "spam"
      ? "spam"
      : mapped === "lost" || mapped === "nurture"
        ? mapped
        : null;
  const bookings = bookingsOf(lead);
  return {
    id: lead.id,
    name: leadName(lead),
    company: lead.companyName,
    email: lead.email,
    stage:
      mapped === "lost" || mapped === "nurture"
        ? null
        : (mapped as Stage | null),
    exit,
    status: status && { ...status, tone: status.tone as LeadStatus["tone"] },
    verdict: lead.verdict ?? "awaiting",
    owner: owner && { id: owner.id, name: personName(owner) },
    nextBooking:
      bookings.find((booking) => booking.state === "confirmed") ?? null,
    bookings,
    createdAt: lead.createdAt.toISOString(),
    lastActivityAt: iso(lead.lastActivityAt),
    archivedAt: iso(lead.deletedAt),
    lastSync,
  };
}

/** Form answers as stored: a list of {question, answer}, or an object of answers by question. */
function formAnswersOf(stored: unknown): LeadDetail["formAnswers"] {
  const pairs = Array.isArray(stored)
    ? stored
    : stored && typeof stored === "object"
      ? Object.entries(stored).map(([question, answer]) => ({
          question,
          answer,
        }))
      : [];
  return pairs.flatMap((pair) =>
    pair && typeof pair === "object" && "question" in pair && "answer" in pair
      ? [{ question: String(pair.question), answer: String(pair.answer) }]
      : [],
  );
}

/** The detail fields that need no other table. */
function toDetailBase(row: Row, lastSync: SyncEntry | null): LeadDetail {
  const { lead } = row;
  return {
    ...toListItem(row, lastSync),
    phone: lead.phone,
    website: lead.website,
    source: lead.leadSource,
    budget: null,
    archivedReason: lead.deletedReason,
    formAnswers: formAnswersOf(lead.formAnswers),
    updatedAt: lead.updatedAt.toISOString(),
    verdictRecord: null,
    deck: null,
    proposal: null,
    invoice: null,
    activities: [],
    syncLog: [],
  };
}

const actor = {
  id: profiles.id,
  firstName: profiles.firstName,
  lastName: profiles.lastName,
};

/** lead_status_events with the acting user's name, for a timeline. */
const eventRows = () =>
  db
    .select({ event: leadStatusEvents, actor })
    .from(leadStatusEvents)
    .leftJoin(profiles, eq(profiles.id, leadStatusEvents.actorId));

/** A lead_status_events row as a timeline entry. */
export function toActivity({
  event,
  actor: person,
}: {
  event: typeof leadStatusEvents.$inferSelect;
  actor: { firstName: string; lastName: string } | null;
}): Activity {
  const changes = [
    event.fromStage !== event.toStage &&
      event.toStage &&
      `Stage: ${event.fromStage ?? "none"} → ${event.toStage}`,
    event.fromStatus !== event.toStatus &&
      event.toStatus &&
      `Lead Status: ${event.fromStatus ?? "none"} → ${event.toStatus}`,
  ].filter((change): change is string => Boolean(change));
  const user = event.actor === "user";
  return {
    id: event.id,
    actor: user
      ? { kind: "user", name: person ? personName(person) : "A former user" }
      : { kind: "crm", name: "CRM" },
    // The app's own events carry their decision as the note; the connector's
    // note says what it did ("created", "corrected: …").
    type:
      user && event.note
        ? event.note
        : changes.length
          ? changes[0].startsWith("Stage")
            ? "Stage changed"
            : "Lead Status changed"
          : "Updated from the CRM",
    detail: [...changes, user ? null : event.note].filter(Boolean).join(". "),
    time: event.createdAt.toISOString(),
  };
}

/** The latest sync-log entry per lead, for the list's sync indicators. */
async function lastSyncOf(leadIds: string[]) {
  if (!leadIds.length) return new Map<string, SyncEntry>();
  const rows = await db
    .selectDistinctOn([ghlSyncLog.leadId])
    .from(ghlSyncLog)
    .where(inArray(ghlSyncLog.leadId, leadIds))
    .orderBy(ghlSyncLog.leadId, desc(ghlSyncLog.updatedAt));
  return new Map(rows.map((row) => [row.leadId as string, toSyncEntry(row)]));
}

const isUuid = (value: string) => z.uuid().safeParse(value).success;

/** One lead in the profile's scope, or not_found. A lead outside the scope does not exist. */
async function findRow(profile: Profile, leadId: string): Promise<Row> {
  if (!isUuid(leadId)) throw new AccessError("not_found");
  const [row] = await scopedRows(profile, eq(leads.id, leadId));
  if (!row) throw new AccessError("not_found");
  return row;
}

async function detailOf(profile: Profile, leadId: string): Promise<LeadDetail> {
  const row = await findRow(profile, leadId);
  // Found through the scope: what belongs to it may now be read by its id.
  const [syncRows, events, runs] = await Promise.all([
    db
      .select()
      .from(ghlSyncLog)
      .where(eq(ghlSyncLog.leadId, leadId))
      .orderBy(desc(ghlSyncLog.createdAt)),
    eventRows()
      .where(eq(leadStatusEvents.leadId, leadId))
      .orderBy(desc(leadStatusEvents.createdAt)),
    db
      .select({ run: validationRuns, actor })
      .from(validationRuns)
      .leftJoin(profiles, eq(profiles.id, validationRuns.overriddenBy))
      .where(eq(validationRuns.leadId, leadId))
      .orderBy(desc(validationRuns.createdAt)),
  ]);
  const syncLog = syncRows.map(toSyncEntry);
  const ai = runs.find(({ run }) => run.source !== "human")?.run;
  const human = runs.find(({ run }) => run.source === "human");
  return {
    ...toDetailBase(row, syncLog[0] ?? null),
    verdictRecord: ai
      ? {
          result: ai.verdict,
          summary: ai.summary ?? "",
          reasons: ai.reasons ?? [],
          reviewOutcome: human
            ? human.run.verdict === "spam"
              ? "spam"
              : "cleared"
            : null,
          reviewedBy: human?.actor ? personName(human.actor) : null,
          reviewedAt: iso(human?.run.createdAt ?? null),
        }
      : null,
    activities: events.map(toActivity),
    syncLog,
  };
}

// --- reads ----------------------------------------------------------------------

const ORDER: Record<ListLeadsQuery["sort"], SQL | PgColumn> = {
  recent: leads.updatedAt,
  // Age is now minus the last activity, so the oldest lead has the earliest time.
  age: leads.lastActivityAt,
  next_booking: nextBookingAt,
};

/** A page of the lead list (spec 07). */
export async function listLeads(query: ListLeadsQuery): Promise<LeadPage> {
  const viewer = await requireProfile();

  const text = query.q?.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${text}%`;
  // The rep filter is the admins' (spec 07): a rep's scope already is their own leads.
  const owner = viewer.role === "admin" ? query.owner : undefined;
  const where = [
    query.archived ? isNotNull(leads.deletedAt) : isNull(leads.deletedAt),
    tabCondition(query.tab),
    query.verdict &&
      (query.verdict === "awaiting"
        ? isNull(leads.verdict)
        : eq(leads.verdict, query.verdict)),
    owner &&
      (owner === UNASSIGNED
        ? isNull(leads.assignedTo)
        : isUuid(owner)
          ? eq(leads.assignedTo, owner)
          : sql`false`),
    query.group && eq(statusDefs.groupName, query.group),
    query.needs && and(isOpen, needsCondition(query.needs, query.tz)),
    text &&
      or(
        sql`concat_ws(' ', ${leads.firstName}, ${leads.lastName}) ilike ${pattern}`,
        sql`${leads.companyName} ilike ${pattern}`,
        sql`${leads.email} ilike ${pattern}`,
      ),
  ].filter((condition): condition is SQL => Boolean(condition));

  // The suspect queue is oldest first, so nobody waits longest by accident.
  const suspects = query.needs === "suspects";
  const column = suspects ? leads.createdAt : ORDER[query.sort];
  // Age runs the other way from its column: the oldest has the earliest activity.
  const ascending = suspects
    ? true
    : (query.sort === "age") !== (query.dir === "asc");
  // ponytail: the cursor is an offset, exact while the data stands still. Use a
  // keyset cursor (the sort column, id) if paging past moving rows matters.
  const start = Math.max(0, Number.parseInt(query.cursor ?? "0", 10) || 0);
  const rows = await db
    .select({ ...ROW, total: sql<number>`count(*) over()`.mapWith(Number) })
    .from(leads)
    .leftJoin(profiles, eq(profiles.id, leads.assignedTo))
    .leftJoin(statusDefs, eq(statusDefs.value, leads.leadStatus))
    .where(and(leadScope(viewer), ...where))
    // Nulls last in both directions (spec 07): never-synced leads sort last.
    .orderBy(
      sql`${column} is null`,
      ascending ? asc(column) : desc(column),
      asc(leads.id),
    )
    .limit(query.limit)
    .offset(start);

  const total = rows[0]?.total ?? 0;
  const syncs = await lastSyncOf(rows.map((row) => row.lead.id));
  const end = start + rows.length;
  return {
    items: rows.map((row) => toListItem(row, syncs.get(row.lead.id) ?? null)),
    nextCursor: end < total ? String(end) : null,
    total,
  };
}

const countWhere = (condition: SQL | undefined) =>
  sql<number>`count(*) filter (where ${condition ?? sql`true`})`.mapWith(
    Number,
  );

/** Counts per stage and exit, the four "needs you" counts and the rep filter's choices. */
export async function getPipelineSummary(query: {
  tz: string;
}): Promise<PipelineSummary> {
  const viewer = await requireProfile();

  const [counts] = await db
    .select({
      open: countWhere(isOpen),
      ...Object.fromEntries(
        STAGES.map((stage) => [
          `stage:${stage}`,
          countWhere(tabCondition(stage)),
        ]),
      ),
      ...Object.fromEntries(
        EXITS.map((exit) => [`exit:${exit}`, countWhere(tabCondition(exit))]),
      ),
      ...Object.fromEntries(
        NEEDS.map((need) => [
          `need:${need}`,
          countWhere(and(isOpen, needsCondition(need, query.tz))),
        ]),
      ),
    })
    .from(leads)
    .where(and(leadScope(viewer), isNull(leads.deletedAt)));
  const count = counts as Record<string, number>;

  const owners =
    viewer.role === "admin"
      ? (
          await db
            .select(actor)
            .from(profiles)
            .where(eq(profiles.active, true))
            .orderBy(asc(profiles.firstName), asc(profiles.lastName))
        ).map((person) => ({ id: person.id, name: personName(person) }))
      : [{ id: viewer.id, name: personName(viewer) }];

  const pick = <K extends string>(keys: readonly K[], prefix: string) =>
    Object.fromEntries(
      keys.map((key) => [key, count[`${prefix}:${key}`]]),
    ) as Record<K, number>;
  return {
    open: count.open,
    stages: pick(STAGES, "stage"),
    exits: pick(EXITS, "exit"),
    needs: pick(NEEDS, "need"),
    owners,
  };
}

/** One lead in detail: the header, its bookings, its timeline and its writes to GHL. */
export async function getLead(leadId: string): Promise<LeadDetail> {
  return detailOf(await requireProfile(), leadId);
}

// --- writes ---------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The lead in the profile's scope, locked until the transaction ends, so two
 * clicks on the same action make one decision: the second waits, then finds
 * the decision already made. NO KEY UPDATE, not UPDATE: it only has to stop a
 * second decision, not the foreign keys other rows hold on the lead (KEY SHARE).
 */
async function lockLead(tx: Tx, profile: Profile, leadId: string) {
  if (!isUuid(leadId)) throw new AccessError("not_found");
  const [lead] = await tx
    .select()
    .from(leads)
    .where(and(leadScope(profile), eq(leads.id, leadId)))
    .for("no key update");
  if (!lead) throw new AccessError("not_found");
  return lead;
}

/** What `nextStep` needs, from the row: the same rule the page shows. */
const stepOf = (lead: LeadRow) =>
  nextStep(toListItem({ lead, owner: null, status: null }, null));

/**
 * Makes a decision on a locked lead in one short transaction, then sends the
 * GHL write it queued (if any) after the commit, and reads the lead back
 * through the scope.
 *
 * GHL is called outside any transaction: a slow GHL (429 backoff, the request
 * timeout) never holds the lead's lock or a second pooled connection, and a
 * failed write, or a crash after the commit, leaves the decision standing with
 * its sync-log row pending or failed, to retry from there (spec 06).
 */
async function change(
  profile: Profile,
  leadId: string,
  decide: (tx: Tx, lead: LeadRow) => Promise<Write | undefined>,
): Promise<LeadDetail> {
  const write = await db.transaction(async (tx) => {
    const lead = await lockLead(tx, profile, leadId);
    if (lead.deletedAt) throw new AccessError("conflict");
    return decide(tx, lead);
  });
  // Picks up the pending row `queue` logged under the same key.
  if (write) await runWrite(write);
  return detailOf(profile, leadId);
}

/**
 * Logs a decision's GHL write as pending in the decision's own transaction, so
 * the two commit together; `change` sends it after the commit. Returns the
 * row's id, for the event's sync_log_id.
 */
async function queue(tx: Tx, write: Write): Promise<string> {
  const [row] = await tx
    .insert(ghlSyncLog)
    .values({
      leadId: write.leadId,
      writeType: write.writeType,
      idempotencyKey: write.idempotencyKey,
      payload: write.plan,
    })
    .returning({ id: ghlSyncLog.id });
  return row.id;
}

/** A timeline entry made by the signed-in person. The table is append-only. */
const event = (
  tx: Tx,
  profile: Profile,
  lead: LeadRow,
  values: Partial<typeof leadStatusEvents.$inferInsert> & { note: string },
) =>
  tx.insert(leadStatusEvents).values({
    leadId: lead.id,
    fromStage: lead.stage,
    toStage: lead.stage,
    fromStatus: lead.leadStatus,
    toStatus: lead.leadStatus,
    actor: "user",
    actorId: profile.id,
    ...values,
  });

/*
 * A decision that GHL receives (W3, W4, W1) is one lead_status_events row and
 * one ghl_sync_log row, linked by the event's sync_log_id, committed together
 * (the row pending) before GHL is called. The event is append-only, so the
 * decision id is made first and the event is inserted already linked.
 */

/** Qualify or Not qualified after the discovery call: W3, and the stage it sets (spec 06). */
export async function setQualification(
  leadId: string,
  input: QualificationInput,
): Promise<LeadDetail> {
  const user = await requireProfile();
  return change(user, leadId, async (tx, lead) => {
    if (!stepOf(lead).canQualify || !lead.ghlOpportunityId) {
      throw new AccessError("conflict");
    }
    const id = randomUUID();
    const write = qualificationWrite(
      { id: lead.id, ghlOpportunityId: lead.ghlOpportunityId },
      input.decision,
      id,
    );
    const toStage = input.decision === "qualified" ? "Qualified" : "Lead Lost";
    await event(tx, user, lead, {
      id,
      toStage,
      syncLogId: await queue(tx, write),
      note: input.decision === "qualified" ? "Qualified" : "Not qualified",
    });
    await tx.update(leads).set({ stage: toStage }).where(eq(leads.id, lead.id));
    return write;
  });
}

/**
 * Marks the lead spam: W4, nothing else in GHL (spec 06). GHL does the removal.
 * Both ways in (Mark as spam, and the review queue's spam) are refused here
 * unless the lead allows it: a won lead is never marked spam.
 */
async function markAsSpam(tx: Tx, user: Profile, lead: LeadRow) {
  if (!stepOf(lead).canMarkSpam) throw new AccessError("conflict");
  const id = randomUUID();
  const write = markSpamWrite(
    { id: lead.id, ghlContactId: lead.ghlContactId },
    id,
  );
  await event(tx, user, lead, {
    id,
    syncLogId: await queue(tx, write),
    note: "Marked as spam",
  });
  await tx.update(leads).set({ verdict: "spam" }).where(eq(leads.id, lead.id));
  return write;
}

export async function markSpam(leadId: string): Promise<LeadDetail> {
  const user = await requireProfile();
  return change(user, leadId, (tx, lead) => markAsSpam(tx, user, lead));
}

/**
 * A rep's decision on a suspect (spec 08): Clear as valid writes W1 Valid;
 * Mark as spam is W4. Either appends a human validation run naming who decided.
 * A suspect someone already decided answers `conflict` ("already decided").
 */
export async function reviewSuspect(
  leadId: string,
  input: ReviewInput,
): Promise<LeadDetail> {
  const user = await requireProfile();
  return change(user, leadId, async (tx, lead) => {
    if (!stepOf(lead).canReview) throw new AccessError("conflict");
    const run = {
      leadId: lead.id,
      source: "human" as const,
      overriddenBy: user.id,
    };
    if (input.outcome === "spam") {
      const write = await markAsSpam(tx, user, lead);
      await tx.insert(validationRuns).values({ ...run, verdict: "spam" });
      return write;
    }
    const [latest] = await tx
      .select({ summary: validationRuns.summary })
      .from(validationRuns)
      .where(
        and(
          eq(validationRuns.leadId, lead.id),
          sql`${validationRuns.source} <> 'human'`,
        ),
      )
      .orderBy(desc(validationRuns.createdAt))
      .limit(1);
    const id = randomUUID();
    const write = validationVerdictWrite(
      { id: lead.id, ghlContactId: lead.ghlContactId },
      "valid",
      latest?.summary ?? "",
      id,
    );
    await tx.insert(validationRuns).values({ ...run, id, verdict: "valid" });
    await event(tx, user, lead, {
      syncLogId: await queue(tx, write),
      note: "Cleared as valid",
    });
    await tx
      .update(leads)
      .set({ verdict: "valid" })
      .where(eq(leads.id, lead.id));
    return write;
  });
}

/** Change status (spec 07): app only. Admins, and reps for REP_SETTABLE_STATUSES only. */
export async function changeStatus(
  leadId: string,
  input: StatusInput,
): Promise<LeadDetail> {
  const user = await requireProfile();
  return change(user, leadId, async (tx, lead): Promise<undefined> => {
    if (
      user.role !== "admin" &&
      !REP_SETTABLE_STATUSES.includes(input.status)
    ) {
      throw new AccessError("forbidden");
    }
    if (lead.leadStatus === input.status) return;
    const [known] = await tx
      .select({ value: statusDefs.value })
      .from(statusDefs)
      .where(eq(statusDefs.value, input.status));
    if (!known) throw new AccessError("conflict");
    await event(tx, user, lead, {
      toStatus: input.status,
      note: "Lead Status changed",
    });
    await tx
      .update(leads)
      .set({ leadStatus: input.status })
      .where(eq(leads.id, lead.id));
  });
}

/** Assign rep (admin, spec 07): app only until assignment rules exist. Null unassigns. */
export async function assignRep(
  leadId: string,
  input: AssignInput,
): Promise<LeadDetail> {
  const admin = await requireAdmin();
  return change(admin, leadId, async (tx, lead): Promise<undefined> => {
    if (lead.assignedTo === input.profileId) return;
    let note = "Unassigned";
    if (input.profileId) {
      const [rep] = await tx
        .select(actor)
        .from(profiles)
        .where(
          and(eq(profiles.id, input.profileId), eq(profiles.active, true)),
        );
      if (!rep) throw new AccessError("conflict");
      note = `Assigned to ${personName(rep)}`;
    }
    await event(tx, admin, lead, { note });
    await tx
      .update(leads)
      .set({ assignedTo: input.profileId })
      .where(eq(leads.id, lead.id));
  });
}

/** Archive (spec 07): a soft delete in the app only; nothing is written to GHL. */
export async function archiveLead(
  leadId: string,
  input: ArchiveInput,
): Promise<LeadDetail> {
  const user = await requireProfile();
  return change(user, leadId, async (tx, lead): Promise<undefined> => {
    await event(tx, user, lead, { note: "Archived" });
    await tx
      .update(leads)
      .set({ deletedAt: new Date(), deletedReason: input.reason || null })
      .where(eq(leads.id, lead.id));
  });
}

// ---------------------------------------------------------------------------
// For the other data-access modules (decks, proposals, invoices,
// notifications), still on sample data of their own until specs 09, 12 and 13
// read their tables. Not called by Route Handlers.
// ---------------------------------------------------------------------------

/**
 * Every lead the viewer may see and has not archived, in no particular order.
 * ponytail: without the timeline, sync log or verdict record (one query, not
 * one per lead); a caller that needs those reads `getLead`.
 */
export async function listVisibleLeads(): Promise<LeadDetail[]> {
  const viewer = await requireProfile();
  const rows = await scopedRows(viewer, isNull(leads.deletedAt));
  return rows.map((row) => toDetailBase(row, null));
}

/**
 * The sample proposals, invoices and decks modules record their changes on the
 * lead through these. A real lead has none of them yet (its `deck`, `proposal`
 * and `invoice` are null), so after the guard each is refused until those
 * specs write their own tables and the lead's stage moves through GHL (W5, W6).
 */
export async function recordProposalStatus(
  leadId: string,
  _status: NonNullable<LeadDetail["proposal"]>["status"],
): Promise<LeadDetail> {
  await getLead(leadId);
  throw new AccessError("conflict");
}

export async function recordInvoiceDraft(leadId: string): Promise<LeadDetail> {
  await getLead(leadId);
  throw new AccessError("conflict");
}

export async function recordDeckTemplate(
  leadId: string,
  _templateName: string,
): Promise<LeadDetail> {
  await getLead(leadId);
  throw new AccessError("conflict");
}

// Read by the dashboard module (src/lib/data/dashboard.ts).
export { discovery, isOpen, review };
