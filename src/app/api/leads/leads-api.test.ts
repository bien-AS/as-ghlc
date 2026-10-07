// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST as postLost } from "@/app/api/leads/[leadId]/lost/route";
import { POST as postQualification } from "@/app/api/leads/[leadId]/qualification/route";
import { POST as postReview } from "@/app/api/leads/[leadId]/review/route";
import { GET as getLead } from "@/app/api/leads/[leadId]/route";
import { POST as postSpam } from "@/app/api/leads/[leadId]/spam/route";
import { GET as getLeads } from "@/app/api/leads/route";
import { GET as getSummary } from "@/app/api/pipeline/summary/route";
import { resetSampleLeads } from "@/lib/data/leads";
import {
  type LeadDetail,
  type LeadPage,
  leadDetailSchema,
  leadPageSchema,
  pipelineSummarySchema,
} from "@/lib/leads/schemas";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);

const ORIGIN = "http://localhost:3000";
const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-10-07T12:00:00.000Z"),
  });
  resetFakes();
  resetSampleLeads();
  signIn();
  fake.users.set(ada.id, ada);
});
afterEach(() => vi.useRealTimers());

const leads = (search = "") =>
  getLeads(new Request(`${ORIGIN}/api/leads${search}`));
const summary = (search = "") =>
  getSummary(new Request(`${ORIGIN}/api/pipeline/summary${search}`));
const lead = (leadId: string) =>
  getLead(new Request(`${ORIGIN}/api/leads/${leadId}`), {
    params: Promise.resolve({ leadId }),
  });

const WRITES = {
  review: postReview,
  qualification: postQualification,
  lost: postLost,
  spam: postSpam,
};
const VALID: Record<keyof typeof WRITES, unknown> = {
  review: { outcome: "cleared" },
  qualification: { decision: "qualified" },
  lost: { reason: "Chose another agency" },
  spam: {},
};
const write = (
  route: keyof typeof WRITES,
  leadId: string,
  body: unknown = VALID[route],
) =>
  WRITES[route](
    new Request(`${ORIGIN}/api/leads/${leadId}/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ leadId }) },
  );

/** Every route, each called with input it would accept. */
const everyRoute = (): [string, () => Promise<Response>][] => [
  ["GET /api/leads", () => leads()],
  ["GET /api/pipeline/summary", () => summary()],
  ["GET /api/leads/{id}", () => lead("lead-01")],
  ...(Object.keys(WRITES) as (keyof typeof WRITES)[]).map(
    (route): [string, () => Promise<Response>] => [
      `POST /api/leads/{id}/${route}`,
      () => write(route, "lead-03"),
    ],
  ),
];

const firstSuspect = async () => {
  const page = (await (await leads("?needs=suspects")).json()) as LeadPage;
  return page.items[0].id;
};
const detail = async (leadId: string) =>
  (await (await lead(leadId)).json()) as LeadDetail;

test("signed out, every route answers 401 unauthenticated", async () => {
  fake.claims = null;
  for (const [name, call] of everyRoute()) {
    const response = await call();
    expect(response.status, name).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated" },
    });
  }
});

test("signed in without a profile, every route answers 403 profile_required", async () => {
  fake.users.clear();
  for (const [name, call] of everyRoute()) {
    const response = await call();
    expect(response.status, name).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "profile_required" },
    });
  }
});

/** Every route that takes input, each called with input it would refuse. */
const everyRouteWithInvalidInput = (): [string, () => Promise<Response>][] => [
  ["GET /api/leads", () => leads("?stage=nowhere")],
  ["GET /api/pipeline/summary", () => summary("?surprise=1")],
  ["POST /api/leads/{id}/review", () => write("review", "lead-03", {})],
  [
    "POST /api/leads/{id}/review (not JSON)",
    () => write("review", "lead-03", "not json"),
  ],
  [
    "POST /api/leads/{id}/qualification",
    () => write("qualification", "lead-03", { decision: "maybe" }),
  ],
  ["POST /api/leads/{id}/lost", () => write("lost", "lead-03", { reason: 7 })],
  ["POST /api/leads/{id}/spam", () => write("spam", "lead-03", { extra: 1 })],
];

test("the guard runs before validation: signed out with invalid input, every route answers 401, not 400", async () => {
  fake.claims = null;
  for (const [name, call] of everyRouteWithInvalidInput()) {
    const response = await call();
    expect(response.status, name).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated" },
    });
  }
});

test("the guard runs before validation: without a profile and with invalid input, every route answers 403, not 400", async () => {
  fake.users.clear();
  for (const [name, call] of everyRouteWithInvalidInput()) {
    const response = await call();
    expect(response.status, name).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "profile_required" },
    });
  }
});

test("signed in with a profile, the same invalid input is a 400 naming the problem", async () => {
  for (const [name, call] of everyRouteWithInvalidInput()) {
    const response = await call();
    expect(response.status, name).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_input");
  }
});

test("GET /api/leads returns a page that parses against the contract, 25 by default", async () => {
  const response = await leads();
  expect(response.status).toBe(200);
  const page = leadPageSchema.parse(await response.json());
  expect(page.items).toHaveLength(25);
  expect(page.nextCursor).not.toBeNull();
  expect(page.total).toBeGreaterThan(25);

  const next = leadPageSchema.parse(
    await (await leads(`?cursor=${page.nextCursor}`)).json(),
  );
  const ids = [...page.items, ...next.items].map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("GET /api/leads applies search, tab, verdict, owner and needs from the query", async () => {
  const page = leadPageSchema.parse(
    await (await leads("?q=lindgren&tab=new&verdict=valid")).json(),
  );
  expect(page.items.map((item) => item.name)).toEqual(["Sofia Lindgren"]);

  const queue = leadPageSchema.parse(
    await (await leads("?needs=suspects&limit=3")).json(),
  );
  expect(queue.items).toHaveLength(3);
  expect(queue.items.every((item) => item.verdict === "suspect")).toBe(true);
});

test("GET /api/leads rejects an unknown stage, verdict, category, time zone, limit or parameter, naming the field", async () => {
  for (const [search, field] of [
    ["?tab=archived", "tab"],
    ["?verdict=maybe", "verdict"],
    ["?needs=everything", "needs"],
    ["?tz=Mars/Olympus", "tz"],
    ["?limit=0", "limit"],
    ["?limit=5000", "limit"],
    ["?limit=ten", "limit"],
  ]) {
    const response = await leads(search);
    expect(response.status, search).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.fields[field], search).toBeDefined();
  }
  expect((await leads("?workspace=another")).status).toBe(400);
});

test("GET /api/pipeline/summary returns counts that parse against the contract", async () => {
  const response = await summary("?tz=America/New_York");
  expect(response.status).toBe(200);
  const body = pipelineSummarySchema.parse(await response.json());
  expect(body.open).toBeGreaterThan(0);
  expect((await summary("?tz=Nowhere")).status).toBe(400);
});

test("GET /api/leads/{id} returns the lead in detail, and 404 for an unknown id", async () => {
  const response = await lead("lead-01");
  expect(response.status).toBe(200);
  expect(leadDetailSchema.parse(await response.json()).id).toBe("lead-01");

  const missing = await lead("lead-999");
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual({ error: { code: "not_found" } });
});

test("every write answers 404 for an unknown lead", async () => {
  for (const route of Object.keys(WRITES) as (keyof typeof WRITES)[]) {
    const response = await write(route, "lead-999");
    expect(response.status, route).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  }
});

test("review accepts only cleared or spam, returns the updated lead, and a second review is a conflict", async () => {
  const id = await firstSuspect();
  const before = await detail(id);

  for (const body of [
    {},
    { outcome: "maybe" },
    { outcome: "cleared", reviewedBy: "Someone Else" },
    "not json",
    null,
  ]) {
    const response = await write("review", id, body);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_input");
  }
  const named = await write("review", id, { outcome: "maybe" });
  expect((await named.json()).error.fields.outcome).toBeDefined();
  // Invalid input changed nothing.
  expect(await detail(id)).toEqual(before);

  const response = await write("review", id, { outcome: "cleared" });
  expect(response.status).toBe(200);
  const updated = leadDetailSchema.parse(await response.json());
  expect(updated.verdict).toBe("valid");
  expect(updated.verdictRecord?.reviewedBy).toBe("Ada Lovelace");

  const again = await write("review", id, { outcome: "spam" });
  expect(again.status).toBe(409);
  expect(await again.json()).toEqual({ error: { code: "conflict" } });
  expect(await detail(id)).toEqual(updated);
});

test("qualification validates the decision and refuses a lead whose state does not allow it", async () => {
  const page = (await (
    await leads("?tab=discovery_booked&verdict=valid&limit=100")
  ).json()) as LeadPage;
  let ready: string | undefined;
  for (const item of page.items) {
    const candidate = await detail(item.id);
    if (candidate.bookings.some((booking) => booking.state === "completed")) {
      ready = item.id;
      break;
    }
  }
  if (!ready) throw new Error("no sample lead with a completed call");

  expect(
    (await write("qualification", ready, { decision: "yes" })).status,
  ).toBe(400);
  expect((await write("qualification", ready, {})).status).toBe(400);

  const response = await write("qualification", ready);
  expect(response.status).toBe(200);
  expect(leadDetailSchema.parse(await response.json()).stage).toBe("qualified");

  // Already qualified: the same request is now a conflict, and changes nothing.
  const before = await detail(ready);
  const again = await write("qualification", ready);
  expect(again.status).toBe(409);
  expect(await detail(ready)).toEqual(before);
});

test("lost takes an optional reason; spam takes nothing; both refuse a lead that has left", async () => {
  expect((await write("lost", "lead-09", { reason: 7 })).status).toBe(400);
  expect(
    (await write("lost", "lead-09", { reason: "x".repeat(501) })).status,
  ).toBe(400);
  expect((await write("lost", "lead-09", { exit: "nurture" })).status).toBe(
    400,
  );
  expect((await write("spam", "lead-10", { booking: "keep" })).status).toBe(
    400,
  );
  expect((await detail("lead-09")).exit).toBeNull();
  expect((await detail("lead-10")).exit).toBeNull();

  const lost = await write("lost", "lead-09");
  expect(lost.status).toBe(200);
  const lostLead = leadDetailSchema.parse(await lost.json());
  expect(lostLead.exit).toBe("lost");
  expect(lostLead.activities[0].detail).toBe("Reason: Chose another agency");

  const spam = await write("spam", "lead-10");
  expect(spam.status).toBe(200);
  expect(leadDetailSchema.parse(await spam.json()).exit).toBe("spam");

  for (const route of ["lost", "spam"] as const) {
    for (const id of ["lead-09", "lead-10"]) {
      const response = await write(route, id);
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe("conflict");
    }
  }
});
