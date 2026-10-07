import { z } from "zod";

/*
 * The lead contract (spec 04, "The contract"), shaped after the data model
 * sketch in spec 09, whose field lists are assumed. Shared by Route Handlers,
 * hooks, pages and the data-access layer (ADR-0003). No server-only imports
 * and no fixtures here. Going live does not change this file (ADR-0006).
 */

export const STAGES = [
  "new",
  "discovery_booked",
  "qualified",
  "review_booked",
  "proposal_sent",
  "won",
] as const;
export const EXITS = ["spam", "nurture", "lost"] as const;
/** Question 8: assumed to be the prototype's status lines. One list; change it here. */
export const STATUSES = [
  "awaiting_verdict",
  "flagged_suspect",
  "drip_chasing",
  "deck_ready",
  "needs_decision",
  "qualified",
  "proposal_ready",
  "not_a_fit",
  "removed",
] as const;
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

export const stageSchema = z.enum(STAGES);
export const exitSchema = z.enum(EXITS);
export const statusSchema = z.enum(STATUSES);
export const verdictSchema = z.enum(VERDICTS);
export const needSchema = z.enum(NEEDS);

export type Stage = z.infer<typeof stageSchema>;
export type Exit = z.infer<typeof exitSchema>;
export type Status = z.infer<typeof statusSchema>;
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

/** One row of the Pipeline and of the suspect queue. */
export const leadListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  stage: stageSchema,
  exit: exitSchema.nullable(),
  status: statusSchema,
  verdict: verdictSchema,
  owner: ownerSchema,
  /** The next confirmed call, if any. */
  nextBooking: bookingSchema.nullable(),
  createdAt: isoTime,
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
  source: z.string(),
  budget: z.string().nullable(),
  formAnswers: z.array(z.object({ question: z.string(), answer: z.string() })),
  updatedAt: isoTime,
  /** Absent while the lead is awaiting a verdict. */
  verdictRecord: verdictRecordSchema.nullable(),
  bookings: z.array(bookingSchema),
  deck: z
    .object({
      templateName: z.string(),
      viewUrl: z.string(),
      pdfUrl: z.string(),
    })
    .nullable(),
  proposal: z.object({ status: z.enum(PROPOSAL_STATUSES) }).nullable(),
  invoice: z.object({ status: z.string() }).nullable(),
  /** Newest first. */
  activities: z.array(activitySchema),
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

/** Query of GET /api/leads. Every value arrives as text from the address. */
export const listLeadsQuerySchema = z.strictObject({
  q: z.string().trim().max(200).optional(),
  tab: pipelineTabSchema.default("open"),
  verdict: verdictSchema.optional(),
  owner: z.string().max(100).optional(),
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
  owners: z.array(ownerSchema),
});
export type PipelineSummary = z.infer<typeof pipelineSummarySchema>;

/** Bodies of the four write routes. Strict: an unknown field is rejected. */
export const reviewInputSchema = z.strictObject({
  outcome: z.enum(["cleared", "spam"]),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const qualificationInputSchema = z.strictObject({
  decision: z.enum(["qualified", "not_qualified"]),
});
export type QualificationInput = z.infer<typeof qualificationInputSchema>;

export const lostInputSchema = z.strictObject({
  reason: z.string().trim().max(500).optional(),
});
export type LostInput = z.infer<typeof lostInputSchema>;

export const spamInputSchema = z.strictObject({});

/**
 * The Pipeline's filters as they sit in the page address. Lenient where the
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
