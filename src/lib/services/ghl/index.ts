import { z } from "zod";

import { leadStage, type leads } from "@/db/schema";

/*
 * The ONE module that talks to GoHighLevel (spec 06, ADR-0009). Only the
 * connector's data-access functions, its Inngest jobs and the startup check
 * (src/instrumentation.ts) import it. Server only: it reads GHL_PRIVATE_TOKEN.
 *
 * Reads live here; the write functions go in ./writes.ts on top of `ghlRequest`.
 */

const BASE_URL = "https://services.leadconnectorhq.com";
const MAX_ATTEMPTS = 5;
/** GHL's largest page for opportunity search. */
export const PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Configuration: ids per environment, never compiled in (spec 06).

const CONTACT_FIELDS = [
  "validation_status",
  "validation_summary",
  "ds_deck_link",
  "lead_source",
  "source_form_id",
  "ingestion_completed",
  "data_quality",
  "last_engagement",
  "engagement_count",
] as const;
const OPPORTUNITY_FIELDS = [
  "lead_status",
  "qualification_decision",
  "appointment_status",
  "proposal_review_session",
] as const;

const ghlId = z.string().min(1);
// A record keyed by an enum is exhaustive in zod 4: every stage and field key is required.
const idsSchema = z.object({
  pipelineId: ghlId,
  stages: z.record(z.enum(leadStage.enumValues), ghlId),
  contactFields: z.record(z.enum(CONTACT_FIELDS), ghlId),
  opportunityFields: z.record(z.enum(OPPORTUNITY_FIELDS), ghlId),
  calendars: z.object({ discovery: ghlId, proposalReview: ghlId }),
  placeholderUserId: ghlId,
});

export type GhlConfig = z.infer<typeof idsSchema> & { locationId: string };

/** GHL_LOCATION_ID plus the GHL_IDS JSON, validated. Throws naming what is wrong. */
export function ghlConfig(): GhlConfig {
  const locationId = process.env.GHL_LOCATION_ID;
  const raw = process.env.GHL_IDS;
  if (!locationId) throw new Error("GHL_LOCATION_ID is not set");
  if (!raw) throw new Error("GHL_IDS is not set");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("GHL_IDS is not valid JSON");
  }
  const ids = idsSchema.safeParse(json);
  if (!ids.success) {
    throw new Error(`GHL_IDS is invalid: ${z.prettifyError(ids.error)}`);
  }
  return { ...ids.data, locationId };
}

// ---------------------------------------------------------------------------
// The request: headers, 429 backoff, and no token in any message.

/** A GHL call that answered with an error status. The message never holds the token. */
export class GhlError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GhlError";
  }
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * How long to wait after a 429: exponential from 1s, but never less than GHL
 * asks for (Retry-After, or the rest of the burst window once
 * X-RateLimit-Remaining is 0).
 */
function backoffMs(res: Response, attempt: number): number {
  const header = (name: string) => Number(res.headers.get(name)) || 0;
  const retryAfter = header("retry-after") * 1000;
  const window =
    res.headers.get("x-ratelimit-remaining") === "0"
      ? header("x-ratelimit-interval-milliseconds")
      : 0;
  return Math.max(1000 * 2 ** attempt, retryAfter, window);
}

/**
 * Every GHL call goes through here: the auth, version and user-agent headers
 * (Cloudflare answers 403 "Error 1010" to a runtime's default user agent), and
 * retry on 429 with exponential backoff. Returns the parsed JSON body.
 */
export async function ghlRequest(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const token = process.env.GHL_PRIVATE_TOKEN;
  if (!token) throw new Error("GHL_PRIVATE_TOKEN is not set");
  const method = init.method ?? "GET";

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Version: "2021-07-28",
        "User-Agent": "as-sales-app/1.0",
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (res.status === 429 && attempt < MAX_ATTEMPTS - 1) {
      await sleep(backoffMs(res, attempt));
      continue;
    }
    if (!res.ok) {
      // Redact before cutting: a cut can leave half a token that replaceAll would miss.
      const body = (await res.text()).replaceAll(token, "[redacted]");
      throw new GhlError(
        res.status,
        `GHL ${res.status} on ${method} ${path}: ${body.slice(0, 300)}`,
      );
    }
    return res.json();
  }
}

const get = async <T extends z.ZodType>(path: string, schema: T) =>
  schema.parse(await ghlRequest(path)) as z.infer<T>;

// ---------------------------------------------------------------------------
// Typed reads. Only the fields the app uses are kept.

const opportunitySchema = z.object({
  id: z.string(),
  contactId: z.string(),
  pipelineId: z.string(),
  pipelineStageId: z.string(),
  assignedTo: z.string().nullish(),
  updatedAt: z.string().nullish(),
  customFields: z
    .array(z.object({ id: z.string(), fieldValueString: z.string().nullish() }))
    .default([]),
});
export type GhlOpportunity = z.infer<typeof opportunitySchema>;

const contactSchema = z.object({
  id: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  companyName: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  website: z.string().nullish(),
  customFields: z
    .array(z.object({ id: z.string(), value: z.unknown() }))
    .default([]),
});
export type GhlContact = z.infer<typeof contactSchema>;

/** The position after the last opportunity of a page (GHL's startAfter / startAfterId). */
export type GhlCursor = { startAfter: number; startAfterId: string };

/** One page of the configured pipeline's opportunities, oldest first; `next` is null on the last page. */
export async function searchPipelineOpportunities(
  cursor: GhlCursor | null,
): Promise<{ opportunities: GhlOpportunity[]; next: GhlCursor | null }> {
  const cfg = ghlConfig();
  const query = new URLSearchParams({
    location_id: cfg.locationId,
    pipeline_id: cfg.pipelineId,
    limit: String(PAGE_SIZE),
    ...(cursor && {
      startAfter: String(cursor.startAfter),
      startAfterId: cursor.startAfterId,
    }),
  });
  const page = await get(
    `/opportunities/search?${query}`,
    z.object({
      opportunities: z.array(opportunitySchema),
      meta: z.object({
        startAfter: z.number().nullish(),
        startAfterId: z.string().nullish(),
      }),
    }),
  );
  const { startAfter, startAfterId } = page.meta;
  const next =
    page.opportunities.length === PAGE_SIZE && startAfter && startAfterId
      ? { startAfter, startAfterId }
      : null;
  return { opportunities: page.opportunities, next };
}

export const getOpportunity = async (id: string) =>
  (
    await get(
      `/opportunities/${encodeURIComponent(id)}`,
      z.object({ opportunity: opportunitySchema }),
    )
  ).opportunity;

/** The contact's opportunity in the configured pipeline, or null (a contact can arrive before its opportunity). */
export async function findContactOpportunity(
  contactId: string,
): Promise<GhlOpportunity | null> {
  const cfg = ghlConfig();
  const query = new URLSearchParams({
    location_id: cfg.locationId,
    pipeline_id: cfg.pipelineId,
    contact_id: contactId,
  });
  const { opportunities } = await get(
    `/opportunities/search?${query}`,
    z.object({ opportunities: z.array(opportunitySchema) }),
  );
  return opportunities[0] ?? null;
}

export const getContact = async (id: string) =>
  (
    await get(
      `/contacts/${encodeURIComponent(id)}`,
      z.object({ contact: contactSchema }),
    )
  ).contact;

// ---------------------------------------------------------------------------
// The copy of a lead (ADR-0009): GHL's names, mirrored, not mapped.

type Lead = typeof leads.$inferInsert;
export type LeadCopy = Required<
  Pick<
    Lead,
    | "ghlOpportunityId"
    | "ghlContactId"
    | "firstName"
    | "lastName"
    | "companyName"
    | "email"
    | "phone"
    | "website"
    | "leadSource"
    | "stage"
    | "leadStatus"
    | "ghlAssignedUserId"
    | "lastActivityAt"
  >
>;

/** The lead columns GHL owns, read from an opportunity and its contact. */
export function leadFromGhl(
  opportunity: GhlOpportunity,
  contact: GhlContact,
  cfg: GhlConfig = ghlConfig(),
): LeadCopy {
  const stage = leadStage.enumValues.find(
    (name) => cfg.stages[name] === opportunity.pipelineStageId,
  );
  if (!stage) {
    throw new Error(
      `Opportunity ${opportunity.id} is in stage ${opportunity.pipelineStageId}, which GHL_IDS does not name`,
    );
  }
  const leadSource = contact.customFields.find(
    (field) => field.id === cfg.contactFields.lead_source,
  )?.value;
  return {
    ghlOpportunityId: opportunity.id,
    ghlContactId: opportunity.contactId,
    firstName: contact.firstName ?? null,
    lastName: contact.lastName ?? null,
    companyName: contact.companyName ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    website: contact.website ?? null,
    leadSource: typeof leadSource === "string" ? leadSource : null,
    stage,
    leadStatus:
      opportunity.customFields.find(
        (field) => field.id === cfg.opportunityFields.lead_status,
      )?.fieldValueString ?? null,
    ghlAssignedUserId: opportunity.assignedTo ?? null,
    lastActivityAt: opportunity.updatedAt
      ? new Date(opportunity.updatedAt)
      : null,
  };
}

// ---------------------------------------------------------------------------
// The startup check (spec 06 acceptance check 1).

const fieldsSchema = z.object({
  customFields: z.array(z.object({ id: z.string(), fieldKey: z.string() })),
});

/**
 * Reads the location's custom fields (opportunity ones need ?model=opportunity),
 * pipeline and calendars, and returns every configured id that is missing, or
 * whose field key is not the one configured. Empty means every id resolves.
 * src/instrumentation.ts runs it at startup and refuses to start on a miss.
 */
export async function checkGhlIds(): Promise<string[]> {
  const cfg = ghlConfig();
  const location = encodeURIComponent(cfg.locationId);
  const fieldKeys = async (model: "contact" | "opportunity") =>
    new Map(
      (
        await get(
          `/locations/${location}/customFields?model=${model}`,
          fieldsSchema,
        )
      ).customFields.map((field) => [field.id, field.fieldKey]),
    );
  const [contactKeys, opportunityKeys, { pipelines }, { calendars }] =
    await Promise.all([
      fieldKeys("contact"),
      fieldKeys("opportunity"),
      get(
        `/opportunities/pipelines?locationId=${location}`,
        z.object({
          pipelines: z.array(
            z.object({
              id: z.string(),
              stages: z.array(z.object({ id: z.string() })),
            }),
          ),
        }),
      ),
      get(
        `/calendars/?locationId=${location}`,
        z.object({ calendars: z.array(z.object({ id: z.string() })) }),
      ),
    ]);

  const missing: string[] = [];
  const fields = (
    model: "contact" | "opportunity",
    configured: Record<string, string>,
    keys: Map<string, string>,
  ) => {
    for (const [key, id] of Object.entries(configured)) {
      if (keys.get(id) !== `${model}.${key}`) {
        missing.push(`${model}Fields.${key} (${id})`);
      }
    }
  };
  fields("contact", cfg.contactFields, contactKeys);
  fields("opportunity", cfg.opportunityFields, opportunityKeys);

  const pipeline = pipelines.find(({ id }) => id === cfg.pipelineId);
  if (!pipeline) missing.push(`pipelineId (${cfg.pipelineId})`);
  const stageIds = new Set(pipeline?.stages.map(({ id }) => id));
  for (const [name, id] of Object.entries(cfg.stages)) {
    if (!stageIds.has(id)) missing.push(`stages.${name} (${id})`);
  }

  const calendarIds = new Set(calendars.map(({ id }) => id));
  for (const [name, id] of Object.entries(cfg.calendars)) {
    if (!calendarIds.has(id)) missing.push(`calendars.${name} (${id})`);
  }
  return missing;
}
