// The seventeen tables of spec 01 section 4, as approved in docs/agents/schema-draft-01.md.
// Every table calls .enableRLS() with no policies: default-deny for the Supabase anon and authenticated roles
// (ADR-0007). The app connects on a privileged role that bypasses RLS; access is checked by the data-access guards.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

export const role = pgEnum("role", ["admin", "rep"]);
export const leadStage = pgEnum("lead_stage", [
  "New Lead",
  "Discovery Call Booked",
  "Qualified",
  "Proposal Review Booked",
  "Proposal Sent",
  "Lead Won",
  "Lead Lost",
  "Nurturing",
]);
export const verdict = pgEnum("verdict", ["valid", "suspect", "spam"]);
export const bookingStatus = pgEnum("booking_status", [
  "booked",
  "showed",
  "no_show",
  "cancelled",
]);
export const bookingKind = pgEnum("booking_kind", [
  "discovery",
  "proposal_review",
]);
export const deckGroup = pgEnum("deck_group", [
  "discovery_call",
  "follow_up",
  "strategy_session",
]);
export const jobStatus = pgEnum("job_status", [
  "generating",
  "ready",
  "failed",
]);
export const validationSource = pgEnum("validation_source", [
  "rule",
  "model",
  "human",
]);
export const statusActor = pgEnum("status_actor", [
  "webhook",
  "reconcile",
  "import",
  "user",
]);
export const writeType = pgEnum("write_type", [
  "w1_verdict",
  "w2_deck_link",
  "w3_qualification",
  "w4_mark_spam",
  "w5_proposal_sent",
  "w6_proposal_signed",
]);
export const writeResult = pgEnum("write_result", [
  "pending",
  "succeeded",
  "failed",
  "skipped",
]);
export const proposalStatus = pgEnum("proposal_status", [
  "generating",
  "draft",
  "sent",
  "viewed",
  "signed",
  "withdrawn",
  "lost",
  "failed",
]);
export const invoiceKind = pgEnum("invoice_kind", ["one_time", "recurring"]);
export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "flagged",
  "sent",
  "viewed",
  "paid",
  "failed",
]);
export const matchState = pgEnum("match_state", [
  "matched",
  "unmatched",
  "not_sales_call",
]);
export const notificationType = pgEnum("notification_type", [
  "suspect_to_review",
  "call_without_deck",
  "recording_matched",
  "recording_unmatched",
  "proposal_viewed",
  "proposal_signed",
  "invoice_pair_ready",
  "ghl_write_failed",
]);
export const provider = pgEnum("provider", [
  "ghl",
  "presenton",
  "smart_pricing_table",
  "invoice_ninja",
  "fathom",
  "openrouter",
]);

const tz = { withTimezone: true } as const;

const timestamps = {
  createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", tz)
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// Null cost = not measured, never 0.
const usage = {
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
};

const id = () => uuid("id").primaryKey().defaultRandom();
const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
const leadId = () =>
  uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" });
const profileRef = (name: string) => uuid(name).references(() => profiles.id);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    email: text("email").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    role: role("role").notNull().default("rep"),
    active: boolean("active").notNull().default(true),
    ghlUserId: text("ghl_user_id").unique(),
    firstRun: boolean("first_run").notNull().default(true),
    celebrationShown: boolean("celebration_shown").notNull().default(false),
    // A missing key means the notification is on.
    notificationPrefs: jsonb("notification_prefs").notNull().default({}),
    ...timestamps,
  },
  (t) => [
    check("profiles_email_lowercase", sql`${t.email} = lower(${t.email})`),
  ],
).enableRLS();

export const statusDefs = pgTable("status_defs", {
  value: text("value").primaryKey(),
  groupName: text("group_name").notNull(),
  position: integer("position").notNull(),
  stages: leadStage("stages").array().notNull(),
  tone: text("tone").notNull(),
  thresholdDays: integer("threshold_days"),
  ...timestamps,
}).enableRLS();

export const leads = pgTable(
  "leads",
  {
    id: id(),
    ghlContactId: text("ghl_contact_id").notNull().unique(),
    ghlOpportunityId: text("ghl_opportunity_id").unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    leadSource: text("lead_source"),
    formAnswers: jsonb("form_answers"),
    stage: leadStage("stage"),
    leadStatus: text("lead_status").references(() => statusDefs.value),
    verdict: verdict("verdict"),
    assignedTo: uuid("assigned_to").references(() => profiles.id, {
      onDelete: "set null",
    }),
    ghlAssignedUserId: text("ghl_assigned_user_id"),
    discoveryBookingAt: timestamp("discovery_booking_at", tz),
    discoveryBookingStatus: bookingStatus("discovery_booking_status"),
    reviewBookingAt: timestamp("review_booking_at", tz),
    reviewBookingStatus: bookingStatus("review_booking_status"),
    lastActivityAt: timestamp("last_activity_at", tz),
    deletedAt: timestamp("deleted_at", tz),
    deletedReason: text("deleted_reason"),
    ...timestamps,
  },
  (t) => [index().on(t.assignedTo)],
).enableRLS();

export const leadResearch = pgTable(
  "lead_research",
  {
    id: id(),
    leadId: leadId(),
    status: jobStatus("status").notNull().default("generating"),
    briefMd: text("brief_md"),
    // Claims with their sources.
    facts: jsonb("facts"),
    error: text("error"),
    ...usage,
    ...timestamps,
  },
  (t) => [index().on(t.leadId, t.createdAt.desc())],
).enableRLS();

// Append-only: a BEFORE UPDATE trigger in the migration rejects updates.
export const validationRuns = pgTable(
  "validation_runs",
  {
    id: id(),
    leadId: leadId(),
    source: validationSource("source").notNull(),
    verdict: verdict("verdict").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    patterns: text("patterns").array(),
    reasons: text("reasons").array(),
    summary: text("summary"),
    inputs: jsonb("inputs"),
    overriddenBy: profileRef("overridden_by"),
    ...usage,
    ...timestamps,
  },
  (t) => [
    index().on(t.leadId, t.createdAt.desc()),
    check(
      "validation_runs_override_is_human",
      sql`(${t.source} = 'human') = (${t.overriddenBy} is not null)`,
    ),
  ],
).enableRLS();

export const ghlSyncLog = pgTable(
  "ghl_sync_log",
  {
    id: id(),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    writeType: writeType("write_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    payload: jsonb("payload").notNull(),
    result: writeResult("result").notNull().default("pending"),
    // Auth headers redacted before storing.
    response: jsonb("response"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [index().on(t.leadId)],
).enableRLS();

// Append-only: a BEFORE UPDATE trigger in the migration rejects updates.
export const leadStatusEvents = pgTable(
  "lead_status_events",
  {
    id: id(),
    leadId: leadId(),
    fromStage: leadStage("from_stage"),
    toStage: leadStage("to_stage"),
    // No FK: history survives a picklist change.
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actor: statusActor("actor").notNull(),
    actorId: profileRef("actor_id"),
    syncLogId: uuid("sync_log_id").references(() => ghlSyncLog.id),
    note: text("note"),
    ...timestamps,
  },
  (t) => [index().on(t.leadId, t.createdAt.desc())],
).enableRLS();

export const deckTemplates = pgTable(
  "deck_templates",
  {
    id: id(),
    group: deckGroup("group").notNull(),
    version: text("version").notNull(),
    manifest: jsonb("manifest"),
    active: boolean("active").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique().on(t.group, t.version),
    uniqueIndex()
      .on(t.group)
      .where(sql`${t.active}`),
  ],
).enableRLS();

export const decks = pgTable(
  "decks",
  {
    id: id(),
    leadId: leadId(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => deckTemplates.id, { onDelete: "restrict" }),
    status: jobStatus("status").notNull(),
    presentonTaskId: text("presenton_task_id"),
    presentonPresentationId: text("presenton_presentation_id"),
    revision: integer("revision").notNull().default(1),
    pdfPath: text("pdf_path"),
    slidesPath: text("slides_path"),
    error: text("error"),
    // Plain text so the link can be shown again.
    shareToken: text("share_token").unique(),
    createdBy: profileRef("created_by"),
    deletedAt: timestamp("deleted_at", tz),
    ...timestamps,
  },
  (t) => [index().on(t.leadId, t.createdAt.desc())],
).enableRLS();

// A Fathom recording.
export const meetings = pgTable(
  "meetings",
  {
    id: id(),
    fathomRecordingId: text("fathom_recording_id").notNull().unique(),
    title: text("title"),
    recordedByEmail: text("recorded_by_email"),
    shareUrl: text("share_url"),
    scheduledStartAt: timestamp("scheduled_start_at", tz),
    recordingStartedAt: timestamp("recording_started_at", tz),
    recordingEndedAt: timestamp("recording_ended_at", tz),
    invitees: jsonb("invitees"),
    summaryMd: text("summary_md"),
    actionItems: jsonb("action_items"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    bookingKind: bookingKind("booking_kind"),
    matchState: matchState("match_state").notNull().default("unmatched"),
    matchRule: text("match_rule"),
    matchEvidence: jsonb("match_evidence"),
    matchedBy: profileRef("matched_by"),
    ...timestamps,
  },
  (t) => [
    index().on(t.leadId, t.createdAt.desc()),
    check(
      "meetings_matched_has_lead",
      sql`${t.matchState} <> 'matched' or ${t.leadId} is not null`,
    ),
  ],
).enableRLS();

// Pasted text is one turn with no speaker.
export const transcripts = pgTable(
  "transcripts",
  {
    id: id(),
    meetingId: uuid("meeting_id")
      .unique()
      .references(() => meetings.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    // {speaker, email?, text, ts?}[]
    turns: jsonb("turns").notNull(),
    createdBy: profileRef("created_by"),
    ...timestamps,
  },
  (t) => [
    index().on(t.leadId, t.createdAt.desc()),
    check(
      "transcripts_meeting_or_lead",
      sql`num_nonnulls(${t.meetingId}, ${t.leadId}) = 1`,
    ),
  ],
).enableRLS();

export const proposals = pgTable(
  "proposals",
  {
    id: id(),
    leadId: leadId(),
    transcriptId: uuid("transcript_id").references(() => transcripts.id),
    status: proposalStatus("status").notNull(),
    sptProposalId: text("spt_proposal_id").unique(),
    clientUrl: text("client_url"),
    extractedValues: jsonb("extracted_values"),
    lineItems: jsonb("line_items"),
    value: money("value"),
    sentAt: timestamp("sent_at", tz),
    viewedAt: timestamp("viewed_at", tz),
    signedAt: timestamp("signed_at", tz),
    error: text("error"),
    ...usage,
    ...timestamps,
  },
  (t) => [index().on(t.leadId, t.createdAt.desc())],
).enableRLS();

export const proposalRevisions = pgTable(
  "proposal_revisions",
  {
    id: id(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    prompt: text("prompt"),
    diff: jsonb("diff"),
    appliedBy: profileRef("applied_by"),
    ...usage,
    ...timestamps,
  },
  (t) => [unique().on(t.proposalId, t.revision)],
).enableRLS();

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "restrict" }),
    kind: invoiceKind("kind").notNull(),
    status: invoiceStatus("status").notNull(),
    invoiceNinjaId: text("invoice_ninja_id").unique(),
    amount: money("amount"),
    lineItems: jsonb("line_items"),
    dueOn: date("due_on"),
    startsOn: date("starts_on"),
    note: text("note"),
    error: text("error"),
    approvedBy: uuid("approved_by").references(() => profiles.id, {
      onDelete: "restrict",
    }),
    events: jsonb("events"),
    ...timestamps,
  },
  (t) => [unique().on(t.proposalId, t.kind)],
).enableRLS();

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    href: text("href"),
    readAt: timestamp("read_at", tz),
    ...timestamps,
  },
  (t) => [index().on(t.profileId, t.createdAt.desc())],
).enableRLS();

// Non-secret config and health only; status is derived (01 section 4 rule 5).
export const integrationConnections = pgTable("integration_connections", {
  provider: provider("provider").primaryKey(),
  config: jsonb("config"),
  lastSuccessAt: timestamp("last_success_at", tz),
  lastErrorAt: timestamp("last_error_at", tz),
  lastError: text("last_error"),
  ...timestamps,
}).enableRLS();

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  ...timestamps,
}).enableRLS();
