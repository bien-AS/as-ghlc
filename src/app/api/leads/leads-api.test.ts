// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { POST as postArchive } from "@/app/api/leads/[leadId]/archive/route";
import { POST as postAssign } from "@/app/api/leads/[leadId]/assign/route";
import { POST as postQualification } from "@/app/api/leads/[leadId]/qualification/route";
import { POST as postReview } from "@/app/api/leads/[leadId]/review/route";
import { GET as getLead } from "@/app/api/leads/[leadId]/route";
import { POST as postSpam } from "@/app/api/leads/[leadId]/spam/route";
import { POST as postStatus } from "@/app/api/leads/[leadId]/status/route";
import { GET as getLeads } from "@/app/api/leads/route";
import { GET as getSummary } from "@/app/api/pipeline/summary/route";
import * as data from "@/lib/data/leads";
import { resetSampleData } from "@/lib/data/sample";
import { AccessError } from "@/lib/data/users";
import {
  EXITS,
  type LeadDetail,
  type LeadPage,
  leadDetailSchema,
  leadPageSchema,
  NEEDS,
  pipelineSummarySchema,
  STAGES,
} from "@/lib/leads/schemas";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);
// The real functions, each wrapped so a test can stand in for the database.
vi.mock("@/lib/data/leads", async (original) => {
  const real = await original<typeof import("@/lib/data/leads")>();
  return {
    ...real,
    listLeads: vi.fn(real.listLeads),
    getPipelineSummary: vi.fn(real.getPipelineSummary),
    getLead: vi.fn(real.getLead),
    reviewSuspect: vi.fn(real.reviewSuspect),
    setQualification: vi.fn(real.setQualification),
    markSpam: vi.fn(real.markSpam),
    changeStatus: vi.fn(real.changeStatus),
    assignRep: vi.fn(real.assignRep),
    archiveLead: vi.fn(real.archiveLead),
  };
});

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
  resetSampleData();
  vi.clearAllMocks();
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

const dashboard = (search = "") =>
  getDashboard(new Request(`${ORIGIN}/api/dashboard${search}`));

const WRITES = {
  review: postReview,
  qualification: postQualification,
  spam: postSpam,
  status: postStatus,
  assign: postAssign,
  archive: postArchive,
};
const VALID: Record<keyof typeof WRITES, unknown> = {
  review: { outcome: "cleared" },
  qualification: { decision: "qualified" },
  spam: {},
  status: { status: "New - Contacted" },
  assign: { profileId: null },
  archive: { reason: "Duplicate" },
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
  ["GET /api/dashboard", () => dashboard()],
  ["GET /api/leads/{id}", () => lead("lead-01")],
  ...(Object.keys(WRITES) as (keyof typeof WRITES)[]).map(
    (route): [string, () => Promise<Response>] => [
      `POST /api/leads/{id}/${route}`,
      () => write(route, "lead-03"),
    ],
  ),
];

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
  ["GET /api/leads (archived)", () => leads("?archived=maybe")],
  ["GET /api/dashboard", () => dashboard("?tz=Mars/Olympus")],
  ["POST /api/leads/{id}/spam", () => write("spam", "lead-03", { extra: 1 })],
  ["POST /api/leads/{id}/status", () => write("status", "lead-03", {})],
  [
    "POST /api/leads/{id}/assign",
    () => write("assign", "lead-03", { profileId: "rep-1" }),
  ],
  [
    "POST /api/leads/{id}/archive",
    () => write("archive", "lead-03", { reason: 7 }),
  ],
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

// --- the routes hand the parsed input to the data layer ------------------------
//
// Leads are rows in Postgres (spec 07): what listLeads and the writes do with
// them is proven on a real database (leads.db.test.ts). Here, each route's own
// part: it passes exactly the parsed input on, answers with what it got back,
// and turns a refusal into its status.

const LEAD = "00000000-0000-4000-8000-000000000001";
const DETAIL: LeadDetail = leadDetailSchema.parse({
  id: LEAD,
  name: "Imogen Vasquez",
  company: "Vasquez Dental",
  email: "imogen@example.com",
  stage: "discovery_booked",
  exit: null,
  status: null,
  verdict: "valid",
  owner: null,
  nextBooking: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  lastActivityAt: null,
  archivedAt: null,
  lastSync: null,
  phone: null,
  website: null,
  source: null,
  budget: null,
  archivedReason: null,
  formAnswers: [],
  updatedAt: "2026-10-01T09:00:00.000Z",
  verdictRecord: null,
  bookings: [],
  deck: null,
  proposal: null,
  invoice: null,
  activities: [],
  syncLog: [],
});

test("GET /api/leads hands listLeads the parsed query, defaults filled in, and answers with its page", async () => {
  const page: LeadPage = { items: [DETAIL], nextCursor: "25", total: 26 };
  vi.mocked(data.listLeads).mockResolvedValueOnce(page);
  const response = await leads();
  expect(response.status).toBe(200);
  expect(leadPageSchema.parse(await response.json())).toEqual(
    leadPageSchema.parse(page),
  );
  expect(data.listLeads).toHaveBeenCalledWith({
    tab: "open",
    archived: false,
    sort: "recent",
    dir: "desc",
    tz: "UTC",
    limit: 25,
  });
});

test("GET /api/leads passes search, stage, verdict, rep, Lead Status group, archived, sort and paging on", async () => {
  vi.mocked(data.listLeads).mockResolvedValueOnce({
    items: [],
    nextCursor: null,
    total: 0,
  });
  await leads(
    "?q=lindgren&tab=new&verdict=valid&owner=unassigned&group=Qualified&archived=true&sort=age&dir=asc&cursor=25&limit=10",
  );
  expect(data.listLeads).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "lindgren",
      tab: "new",
      verdict: "valid",
      owner: "unassigned",
      group: "Qualified",
      archived: true,
      sort: "age",
      dir: "asc",
      cursor: "25",
      limit: 10,
    }),
  );
});

test("GET /api/leads rejects an unknown stage, verdict, category, sort, time zone, limit or parameter, naming the field", async () => {
  for (const [search, field] of [
    ["?tab=archived", "tab"],
    ["?verdict=maybe", "verdict"],
    ["?needs=everything", "needs"],
    ["?sort=oldest", "sort"],
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
  expect(data.listLeads).not.toHaveBeenCalled();
});

test("GET /api/pipeline/summary passes the viewer's time zone and answers with the counts", async () => {
  const counts = pipelineSummarySchema.parse({
    open: 3,
    stages: Object.fromEntries(STAGES.map((stage) => [stage, 0])),
    exits: Object.fromEntries(EXITS.map((exit) => [exit, 0])),
    needs: Object.fromEntries(NEEDS.map((need) => [need, 0])),
    owners: [],
  });
  vi.mocked(data.getPipelineSummary).mockResolvedValueOnce(counts);
  const response = await summary("?tz=America/New_York");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(counts);
  expect(data.getPipelineSummary).toHaveBeenCalledWith({
    tz: "America/New_York",
  });
  expect((await summary("?tz=Nowhere")).status).toBe(400);
});

test("GET /api/leads/{id} answers with the lead, and 404 when the data layer finds none in the viewer's scope", async () => {
  vi.mocked(data.getLead).mockResolvedValueOnce(DETAIL);
  const response = await lead(LEAD);
  expect(response.status).toBe(200);
  expect(leadDetailSchema.parse(await response.json()).id).toBe(LEAD);
  expect(data.getLead).toHaveBeenCalledWith(LEAD);

  vi.mocked(data.getLead).mockRejectedValueOnce(new AccessError("not_found"));
  const missing = await lead("lead-999");
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual({ error: { code: "not_found" } });
});

const WRITE_FUNCTION = {
  review: data.reviewSuspect,
  qualification: data.setQualification,
  spam: data.markSpam,
  status: data.changeStatus,
  assign: data.assignRep,
  archive: data.archiveLead,
} as const;

test("every write passes the lead and its parsed body on once, and answers with the updated lead", async () => {
  for (const route of Object.keys(WRITES) as (keyof typeof WRITES)[]) {
    const run = vi.mocked(WRITE_FUNCTION[route]);
    run.mockResolvedValueOnce(DETAIL);
    const response = await write(route, LEAD);
    expect(response.status, route).toBe(200);
    expect(leadDetailSchema.parse(await response.json()).id).toBe(LEAD);
    expect(run, route).toHaveBeenCalledTimes(1);
    if (route === "spam") expect(run).toHaveBeenCalledWith(LEAD);
    else expect(run).toHaveBeenCalledWith(LEAD, VALID[route]);
  }
});

test("a refusal from the data layer is its status: not found 404, conflict 409, forbidden 403", async () => {
  for (const [code, status] of [
    ["not_found", 404],
    ["conflict", 409],
    ["forbidden", 403],
  ] as const) {
    for (const route of Object.keys(WRITES) as (keyof typeof WRITES)[]) {
      vi.mocked(WRITE_FUNCTION[route]).mockRejectedValueOnce(
        new AccessError(code),
      );
      const response = await write(route, LEAD);
      expect(response.status, `${route} ${code}`).toBe(status);
      expect(await response.json()).toEqual({ error: { code } });
    }
  }
});

test("a body that is not the contract is refused with 400 and never reaches the data layer", async () => {
  const refused: [keyof typeof WRITES, unknown][] = [
    ["review", {}],
    ["review", { outcome: "maybe" }],
    ["review", { outcome: "cleared", reviewedBy: "Someone Else" }],
    ["review", "not json"],
    ["review", null],
    ["qualification", { decision: "yes" }],
    ["qualification", {}],
    ["spam", { booking: "keep" }],
    ["status", { status: "" }],
    ["status", { status: "New - Contacted", note: "hi" }],
    ["assign", { profileId: "rep-1" }],
    ["assign", {}],
    ["archive", { reason: 7 }],
    ["archive", { reason: "x".repeat(501) }],
  ];
  for (const [route, body] of refused) {
    const response = await write(route, LEAD, body);
    expect(response.status, `${route} ${JSON.stringify(body)}`).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_input");
  }
  const named = await write("review", LEAD, { outcome: "maybe" });
  expect((await named.json()).error.fields.outcome).toBeDefined();
  for (const run of Object.values(WRITE_FUNCTION)) {
    expect(vi.mocked(run)).not.toHaveBeenCalled();
  }
});
