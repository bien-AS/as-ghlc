import { z } from "zod";

/*
 * The lead contract (spec 07), read from the synced `leads` table (spec 06).
 * Shared by Route Handlers, hooks, pages and the data-access layer (ADR-0003).
 * No server-only imports here. The parts of the mockup contract that real data
 * answered differently (the status lines, a rep on every lead, a stage on every
 * lead) changed when the data went live; the rest kept its shape (ADR-0006).
 */

export const STAGES = [
  "new",
  "discovery_booked",
  "qualified",
  "review_booked",
  "proposal_sent",
  "won",
] as const;
/** Spam is the verdict; lost and nurture are GHL's Lead Lost and Nurturing stages. */
export const EXITS = ["spam", "nurture", "lost"] as const;
/** The tones a Lead Status takes (status_defs.tone, spec 03). */
export const TONES = ["neutral", "brand", "ok", "warn", "crit"] as const;
/** The AI's result, adjusted by a rep's review; "awaiting" when there is no verdict yet. */
export const VERDICTS = ["valid", "suspect", "spam", "awaiting"] as const;
export const NEEDS = [
  "suspects",
  "calls_today",
  "proposals",
  "invoices",
] as const;
export const BOOKING_STATES = [
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
  "rescheduled",
] as const;
export const PROPOSAL_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "signed",
  "lost",
] as const;
/** ghl_sync_log's write types and results (spec 06). */
export const WRITE_TYPES = [
  "w1_verdict",
  "w2_deck_link",
  "w3_qualification",
  "w4_mark_spam",
  "w5_proposal_sent",
  "w6_proposal_signed",
] as const;
export const WRITE_RESULTS = [
  "pending",
  "succeeded",
  "failed",
  "skipped",
] as const;

export const stageSchema = z.enum(STAGES);
export const exitSchema = z.enum(EXITS);
export const verdictSchema = z.enum(VERDICTS);
export const needSchema = z.enum(NEEDS);

export type Stage = z.infer<typeof stageSchema>;
export type Exit = z.infer<typeof exitSchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type Need = z.infer<typeof needSchema>;

const isoTime = z.iso.datetime();

export const bookingSchema = z.object({
  kind: z.enum(["discovery", "proposal_review"]),
  time: isoTime,
  state: z.enum(BOOKING_STATES),
});
export type Booking = z.infer<typeof bookingSchema>;

const ownerSchema = z.object({ id: z.string(), name: z.string() });

/** The lead's Lead Status (GHL's picklist), with its group and tone from status_defs. */
export const leadStatusSchema = z.object({
  value: z.string(),
  group: z.string(),
  tone: z.enum(TONES),
});
export type LeadStatus = z.infer<typeof leadStatusSchema>;

/** One entry of GHL's Lead Status picklist (status_defs), for the group filter and Change status. */
export const statusDefSchema = leadStatusSchema.extend({
  position: z.number().int(),
});
export type StatusDef = z.infer<typeof statusDefSchema>;

/** One write to GHL for this lead (ghl_sync_log): the seam (spec 06). */
export const syncEntrySchema = z.object({
  id: z.string(),
  writeType: z.enum(WRITE_TYPES),
  result: z.enum(WRITE_RESULTS),
  time: isoTime,
  lastError: z.string().nullable(),
});
export type SyncEntry = z.infer<typeof syncEntrySchema>;

/** One row of the lead list and of the suspect queue. */
export const leadListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  /** Null when the lead left the pipeline (`exit` lost or nurture) or has no stage synced yet. */
  stage: stageSchema.nullable(),
  exit: exitSchema.nullable(),
  status: leadStatusSchema.nullable(),
  verdict: verdictSchema,
  /** Null while unassigned (spec 06 question 5). */
  owner: ownerSchema.nullable(),
  /** The earliest booked call, if any. */
  nextBooking: bookingSchema.nullable(),
  /** Every call, held or not: what `nextStep` reads, so the list and lead detail agree. */
  bookings: z.array(bookingSchema),
  createdAt: isoTime,
  /** GHL's last activity. Age is now minus this; null is "Not measured", never 0. */
  lastActivityAt: isoTime.nullable(),
  /** Set when archived (a soft delete in the app only). */
  archivedAt: isoTime.nullable(),
  /** The latest write to GHL, for the row's sync indicator. */
  lastSync: syncEntrySchema.nullable(),
});
export type LeadListItem = z.infer<typeof leadListItemSchema>;

export const verdictRecordSchema = z.object({
  /** What the AI said. Kept as it was when a rep reviews (spec 09, rule 9). */
  result: z.enum(["valid", "suspect", "spam"]),
  summary: z.string(),
  reasons: z.array(z.string()),
  reviewOutcome: z.enum(["cleared", "spam"]).nullable(),
  reviewedBy: z.string().nullable(),
  reviewedAt: isoTime.nullable(),
});

export const activitySchema = z.object({
  id: z.string(),
  actor: z.object({
    kind: z.enum(["user", "system", "crm"]),
    name: z.string(),
  }),
  type: z.string(),
  detail: z.string(),
  time: isoTime,
});
export type Activity = z.infer<typeof activitySchema>;

export const leadDetailSchema = leadListItemSchema.extend({
  phone: z.string().nullable(),
  website: z.string().nullable(),
  source: z.string().nullable(),
  /** No column holds it yet: always null. */
  budget: z.string().nullable(),
  archivedReason: z.string().nullable(),
  formAnswers: z.array(z.object({ question: z.string(), answer: z.string() })),
  updatedAt: isoTime,
  /** Absent while the lead is awaiting a verdict. */
  verdictRecord: verdictRecordSchema.nullable(),
  /** Null until decks (spec 09) are read from their table. */
  deck: z
    .object({
      templateName: z.string(),
      viewUrl: z.string(),
      pdfUrl: z.string(),
    })
    .nullable(),
  /** Null until proposals (spec 12) are read from their table. */
  proposal: z.object({ status: z.enum(PROPOSAL_STATUSES) }).nullable(),
  /** Null until invoices (spec 13) are read from their table. */
  invoice: z.object({ status: z.string() }).nullable(),
  /** lead_status_events, newest first. */
  activities: z.array(activitySchema),
  /** Every write to GHL for this lead, newest first: the seam rail. */
  syncLog: z.array(syncEntrySchema),
});
export type LeadDetail = z.infer<typeof leadDetailSchema>;

/** A valid IANA time zone name; "today" is the viewer's day (spec 05, proposed). */
const timeZone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Unknown time zone.");

export const LEADS_PAGE_SIZE = 25;

/** "open" is every lead still in the pipeline; otherwise one stage or one exit. */
export const pipelineTabSchema = z.enum(["open", ...STAGES, ...EXITS]);
export type PipelineTab = z.infer<typeof pipelineTabSchema>;

/** The orders the list offers. Age and next booking put nulls last in both directions. */
export const LEAD_SORTS = ["recent", "age", "next_booking"] as const;
export const leadSortSchema = z.enum(LEAD_SORTS);
export const sortDirSchema = z.enum(["asc", "desc"]);
export type LeadSort = z.infer<typeof leadSortSchema>;
/** The owner filter's value for leads nobody is assigned to (admins only). */
export const UNASSIGNED = "unassigned";

/** Query of GET /api/leads. Every value arrives as text from the address. */
export const listLeadsQuerySchema = z.strictObject({
  q: z.string().trim().max(200).optional(),
  /** A stage, an exit, or "open". */
  tab: pipelineTabSchema.default("open"),
  verdict: verdictSchema.optional(),
  /** A rep's profile id, or UNASSIGNED. Admins only: ignored for a rep. */
  owner: z.string().max(100).optional(),
  /** A Lead Status group (status_defs.group_name). */
  group: z.string().trim().max(100).optional(),
  /** "true": archived leads only. Otherwise archived leads are left out. */
  archived: z.stringbool().default(false),
  sort: leadSortSchema.default("recent"),
  dir: sortDirSchema.default("desc"),
  needs: needSchema.optional(),
  tz: timeZone.default("UTC"),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(LEADS_PAGE_SIZE),
});
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type ListLeadsInput = z.input<typeof listLeadsQuerySchema>;

export const leadPageSchema = z.object({
  items: z.array(leadListItemSchema),
  nextCursor: z.string().nullable(),
  /** How many leads match the filters in total, across every page. */
  total: z.number().int(),
});
export type LeadPage = z.infer<typeof leadPageSchema>;

export const summaryQuerySchema = z.strictObject({
  tz: timeZone.default("UTC"),
});

export const pipelineSummarySchema = z.object({
  open: z.number().int(),
  stages: z.record(stageSchema, z.number().int()),
  exits: z.record(exitSchema, z.number().int()),
  needs: z.record(needSchema, z.number().int()),
  /** The rep filter's choices: an admin gets every active profile, a rep only themselves. */
  owners: z.array(ownerSchema),
});
export type PipelineSummary = z.infer<typeof pipelineSummarySchema>;

/** Bodies of the write routes. Strict: an unknown field is rejected. */
export const reviewInputSchema = z.strictObject({
  outcome: z.enum(["cleared", "spam"]),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const qualificationInputSchema = z.strictObject({
  decision: z.enum(["qualified", "not_qualified"]),
});
export type QualificationInput = z.infer<typeof qualificationInputSchema>;

export const spamInputSchema = z.strictObject({});

/** Change status: a Lead Status value (status_defs.value). */
export const statusInputSchema = z.strictObject({
  status: z.string().trim().min(1).max(100),
});
export type StatusInput = z.infer<typeof statusInputSchema>;

/** Assign rep (admin): a profile id, or null to unassign. */
export const assignInputSchema = z.strictObject({
  profileId: z.uuid().nullable(),
});
export type AssignInput = z.infer<typeof assignInputSchema>;

/** Archive: a soft delete in the app only, with an optional reason. */
export const archiveInputSchema = z.strictObject({
  reason: z.string().trim().max(500).optional(),
});
export type ArchiveInput = z.infer<typeof archiveInputSchema>;

/**
 * The lead list's filters as they sit in the page address. Lenient where the
 * API is strict: an unknown value in a pasted link falls back to no filter
 * instead of an error page. The server page and the client screen both read
 * the address through this, so they build the same query key (ADR-0001).
 */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional()
    .catch(undefined);

export const leadFiltersSchema = z.object({
  q: text(200),
  tab: pipelineTabSchema.catch("open"),
  verdict: verdictSchema.optional().catch(undefined),
  owner: text(100),
  group: text(100),
  /** Kept as text, so the filters stay the address's own values. */
  archived: z.literal("true").optional().catch(undefined),
  sort: leadSortSchema.optional().catch(undefined),
  dir: sortDirSchema.optional().catch(undefined),
  needs: needSchema.optional().catch(undefined),
  tz: timeZone.catch("UTC"),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

/** Reads filters from an address. Unset filters are left out, so the result is a stable query key. */
export function parseLeadFilters(
  address: Record<string, unknown>,
  tz: string,
): LeadFilters {
  const filters = leadFiltersSchema.parse({ ...address, tz });
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  ) as LeadFilters;
}

// --- the dashboard (spec 07) --------------------------------------------------

export const NEEDS_YOU_REASONS = [
  "suspect",
  "call_without_deck",
  "past_threshold",
] as const;

const leadRefSchema = z.object({ id: z.string(), name: z.string() });

export const dashboardQuerySchema = summaryQuerySchema;

export const dashboardSchema = z.object({
  /** Leads created since the start of the viewer's week (Monday, in their time zone). */
  newThisWeek: z.number().int(),
  /** Leads whose verdict is Suspect. */
  suspects: z.number().int(),
  /** Discovery and review calls booked in the next 48 hours. */
  callsNext48h: z.number().int(),
  /** Suspects waiting, calls in the next 48 hours without a deck, leads past their status's threshold. */
  needsYou: z.array(
    z.object({
      lead: leadRefSchema,
      reason: z.enum(NEEDS_YOU_REASONS),
      /** The call's time, or since when the lead has waited. */
      time: isoTime.nullable(),
    }),
  ),
  /** The latest timeline entries across the viewer's leads, newest first. */
  activity: z.array(activitySchema.extend({ lead: leadRefSchema })),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
