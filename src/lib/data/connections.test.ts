// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST as postImport } from "@/app/api/connections/[type]/import/route";
import {
  DELETE as deleteConnection,
  POST as postConnection,
} from "@/app/api/connections/[type]/route";
import {
  GET as getMappingRoute,
  PUT as putMappingRoute,
} from "@/app/api/connections/[type]/stage-mapping/route";
import { POST as postSync } from "@/app/api/connections/[type]/sync/route";
import { GET as getConnectionsRoute } from "@/app/api/connections/route";
import { CRM_PROVIDERS, FIXED_PROVIDERS } from "@/lib/connections/providers";
import {
  AVAILABILITY_META,
  CONNECTION_STATUS_META,
  providerIsFixed,
  STAGE_SYNC_DIRECTION,
  stageDirectionText,
} from "@/lib/connections/rules";
import {
  CONNECTION_STATUSES,
  CONNECTION_TYPES,
  type Connection,
  connectionSchema,
  importResultSchema,
  type StageMappingInput,
  stageMappingInputSchema,
  stageMappingSchema,
} from "@/lib/connections/schemas";
import {
  connect,
  disconnect,
  getStageMapping,
  importLeads,
  listConnections,
  saveStageMapping,
  syncNow,
} from "@/lib/data/connections";
import { buildSampleConnections } from "@/lib/data/fixtures/connections";
import { listVisibleLeads } from "@/lib/data/leads";
import { resetSampleData } from "@/lib/data/sample";
import { PREVIEW_ROLE_COOKIE } from "@/lib/data/viewer";
import { STAGES } from "@/lib/leads/schemas";
import * as crm from "@/lib/services/crm";
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
const NOW = new Date("2026-10-07T12:00:00.000Z");
const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};
/** A key no response, log line or stored row may ever contain. */
const KEY = "sk-sample-DO-NOT-KEEP-7f3a91";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  resetFakes();
  resetSampleData();
  signIn();
  fake.users.set(ada.id, ada);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const viewAs = (role: string) => fake.cookies.set(PREVIEW_ROLE_COOKIE, role);
const refusedWith = (code: string) => expect.objectContaining({ code });

const request = (path: string, method: string, body?: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
const at = (type: string) => ({ params: Promise.resolve({ type }) });

const SWAPPED: StageMappingInput = {
  new: "New Lead",
  discovery_booked: "Discovery Session Booked",
  qualified: "Qualified",
  review_booked: "Proposal Review Booked",
  proposal_sent: "Proposal Sent",
  won: "Nurture",
};

const api = {
  list: () => getConnectionsRoute(),
  connect: (type = "invoices", body: unknown = { apiKey: KEY }) =>
    postConnection(request(`/api/connections/${type}`, "POST", body), at(type)),
  disconnect: (type = "proposals") =>
    deleteConnection(request(`/api/connections/${type}`, "DELETE"), at(type)),
  sync: (type = "crm") =>
    postSync(request(`/api/connections/${type}/sync`, "POST"), at(type)),
  import: (type = "crm") =>
    postImport(request(`/api/connections/${type}/import`, "POST"), at(type)),
  getMapping: (type = "crm") =>
    getMappingRoute(
      request(`/api/connections/${type}/stage-mapping`, "GET"),
      at(type),
    ),
  putMapping: (body: unknown = SWAPPED, type = "crm") =>
    putMappingRoute(
      request(`/api/connections/${type}/stage-mapping`, "PUT", body),
      at(type),
    ),
};
/** Every route of the resource, each with a request that would succeed on the sample state. */
const EVERY_ROUTE: [string, () => Promise<Response>][] = [
  ["GET /api/connections", () => api.list()],
  ["POST /api/connections/[type]", () => api.connect()],
  ["DELETE /api/connections/[type]", () => api.disconnect()],
  ["POST /api/connections/[type]/sync", () => api.sync()],
  ["POST /api/connections/[type]/import", () => api.import()],
  ["GET /api/connections/[type]/stage-mapping", () => api.getMapping()],
  ["PUT /api/connections/[type]/stage-mapping", () => api.putMapping()],
];
/** Every data-access function, each with input that would succeed on the sample state. */
const EVERY_FUNCTION: [string, () => Promise<unknown>][] = [
  ["listConnections", () => listConnections()],
  ["connect", () => connect("invoices", { apiKey: KEY })],
  ["disconnect", () => disconnect("decks")],
  ["syncNow", () => syncNow("crm")],
  ["importLeads", () => importLeads()],
  ["getStageMapping", () => getStageMapping()],
  ["saveStageMapping", () => saveStageMapping(SWAPPED)],
];

const code = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;
const byType = async (type: string) =>
  (await listConnections()).find(
    (connection) => connection.type === type,
  ) as Connection;

// --- fixtures, labels and the assumptions --------------------------------------

test("every sample Connection parses, one per type in order, with both states visible", async () => {
  const connections = await listConnections();
  for (const connection of connections) {
    expect(connectionSchema.parse(connection)).toEqual(connection);
  }
  expect(connections.map((connection) => connection.type)).toEqual([
    ...CONNECTION_TYPES,
  ]);
  expect(
    connections.map(({ type, provider, status }) => [
      type,
      provider.name,
      status,
    ]),
  ).toEqual([
    ["crm", CRM_PROVIDERS[0].name, "connected"],
    ["proposals", FIXED_PROVIDERS.proposals.name, "connected"],
    ["invoices", FIXED_PROVIDERS.invoices.name, "not_connected"],
    ["decks", FIXED_PROVIDERS.decks.name, "connected"],
  ]);
  // Only the CRM carries a stage mapping, and only a connected one has synced.
  expect(
    connections.map((connection) => connection.stageMapping !== null),
  ).toEqual([true, false, false, false]);
  expect(connections[2].lastSyncedAt).toBeNull();
  expect(connections[0].lastSyncedAt).toBe("2026-10-07T11:56:00.000Z");
});

test("the sample stage mapping covers the six stages with names the sample CRM has", async () => {
  const { stageMapping } = buildSampleConnections(NOW.getTime());
  expect(stageMappingInputSchema.parse(stageMapping)).toEqual(stageMapping);
  expect(Object.keys(stageMapping)).toEqual([...STAGES]);

  const crmStages = await crm.listStages();
  for (const name of Object.values(stageMapping)) {
    expect(crmStages).toContain(name);
  }
  const mapping = await getStageMapping();
  expect(stageMappingSchema.parse(mapping)).toEqual(mapping);
  expect(mapping).toEqual({ crmStages, mapping: stageMapping });
});

test("every status has a word and a tone, and Planned is a warn chip", () => {
  expect(
    CONNECTION_STATUSES.map((status) => CONNECTION_STATUS_META[status]),
  ).toEqual([
    { label: "Connected", tone: "ok" },
    { label: "Not connected", tone: "neutral" },
    { label: "Syncing", tone: "warn" },
    { label: "Needs attention", tone: "crit" },
  ]);
  expect(AVAILABILITY_META.planned).toEqual({ label: "Planned", tone: "warn" });
});

test("the assumed answers: the app pushes the stage out (question 1), fixed tools (10), one CRM available and one planned (11)", () => {
  expect(STAGE_SYNC_DIRECTION).toBe("app_to_crm");
  expect(stageDirectionText("your CRM")).toMatch(
    /owns a lead's stage and pushes it out to your CRM/,
  );
  expect(CONNECTION_TYPES.map(providerIsFixed)).toEqual([
    false,
    true,
    true,
    true,
  ]);
  expect(CRM_PROVIDERS.map((provider) => provider.availability)).toEqual([
    "available",
    "planned",
  ]);
});

// --- the guards ----------------------------------------------------------------

test.each(EVERY_ROUTE)(
  "%s: signed out is 401, no profile is 403 profile_required, staff is 403 forbidden",
  async (_name, call) => {
    const before = await listConnections();

    viewAs("staff");
    const asStaff = await call();
    expect(asStaff.status).toBe(403);
    expect(await code(asStaff)).toBe("forbidden");

    viewAs("owner");
    fake.users.clear();
    const noProfile = await call();
    expect(noProfile.status).toBe(403);
    expect(await code(noProfile)).toBe("profile_required");

    fake.claims = null;
    const signedOut = await call();
    expect(signedOut.status).toBe(401);
    expect(await code(signedOut)).toBe("unauthenticated");

    // Nothing a refused caller asked for was done.
    signIn();
    fake.users.set(ada.id, ada);
    expect(await listConnections()).toEqual(before);
  },
);

test.each(EVERY_ROUTE)(
  "%s: admin and owner are allowed",
  async (_name, call) => {
    viewAs("admin");
    expect((await call()).status).toBe(200);
    resetSampleData();
    viewAs("owner");
    expect((await call()).status).toBe(200);
  },
);

test.each(EVERY_FUNCTION)(
  "%s refuses staff, a caller without a profile and a signed-out caller, and allows an admin",
  async (_name, call) => {
    viewAs("staff");
    await expect(call()).rejects.toEqual(refusedWith("forbidden"));
    viewAs("admin");
    await expect(call()).resolves.toBeDefined();

    fake.users.clear();
    await expect(call()).rejects.toEqual(refusedWith("profile_required"));
    fake.claims = null;
    await expect(call()).rejects.toEqual(refusedWith("unauthenticated"));
  },
);

test("a refusal comes before validation: staff sending nonsense get 403, not 400", async () => {
  viewAs("staff");
  expect((await api.connect("nonsense", "not json")).status).toBe(403);
  expect((await api.sync("decks")).status).toBe(403);
  expect((await api.putMapping({ nonsense: true })).status).toBe(403);
});

// --- validation ----------------------------------------------------------------

test("an unknown type, an empty key and anything beside the key are invalid input", async () => {
  expect((await api.connect("email")).status).toBe(400);
  expect((await api.disconnect("email")).status).toBe(400);
  for (const body of [
    {},
    { apiKey: "" },
    { apiKey: "   " },
    { apiKey: KEY, provider: "another" },
    "not json",
  ]) {
    const response = await api.connect("invoices", body);
    expect(response.status).toBe(400);
    expect(await code(response)).toBe("invalid_input");
  }
  expect((await byType("invoices")).status).toBe("not_connected");
});

test("sync, import and the stage mapping exist for the CRM only", async () => {
  for (const type of ["proposals", "invoices", "decks", "email"]) {
    expect((await api.sync(type)).status).toBe(400);
    expect((await api.import(type)).status).toBe(400);
    expect((await api.getMapping(type)).status).toBe(400);
    expect((await api.putMapping(SWAPPED, type)).status).toBe(400);
  }
});

test("a stage mapping must name a CRM stage for each of the six stages and nothing else", async () => {
  const { won: _won, ...missingOne } = SWAPPED;
  for (const body of [
    missingOne,
    { ...SWAPPED, won: "" },
    { ...SWAPPED, closed: "Won" },
    { ...SWAPPED, won: 7 },
    "not json",
  ]) {
    expect((await api.putMapping(body)).status).toBe(400);
  }
  // A name the CRM does not have: its stages changed since the form was drawn.
  const unknown = await api.putMapping({ ...SWAPPED, won: "Closed Won" });
  expect(unknown.status).toBe(409);
  expect(await code(unknown)).toBe("conflict");

  expect((await getStageMapping()).mapping.won).toBe("Won");
});

// --- writes show in later reads --------------------------------------------------

test("connecting shows in a later read; connecting twice is a conflict", async () => {
  vi.setSystemTime(new Date("2026-10-07T12:30:00.000Z"));
  const response = await api.connect("invoices");
  expect(response.status).toBe(200);
  const connected = connectionSchema.parse(await response.json());
  expect(connected).toEqual({
    type: "invoices",
    provider: FIXED_PROVIDERS.invoices,
    status: "connected",
    lastSyncedAt: "2026-10-07T12:30:00.000Z",
    stageMapping: null,
  });
  expect(await byType("invoices")).toEqual(connected);

  const again = await api.connect("invoices");
  expect(again.status).toBe(409);
  expect(await code(again)).toBe("conflict");
  await expect(connect("crm", { apiKey: KEY })).rejects.toEqual(
    refusedWith("conflict"),
  );
});

test("disconnecting shows in a later read; disconnecting twice is a conflict", async () => {
  const response = await api.disconnect("proposals");
  expect(response.status).toBe(200);
  expect(connectionSchema.parse(await response.json())).toMatchObject({
    status: "not_connected",
    lastSyncedAt: null,
  });
  expect((await byType("proposals")).status).toBe("not_connected");
  expect((await api.disconnect("proposals")).status).toBe(409);
  await expect(disconnect("invoices")).rejects.toEqual(refusedWith("conflict"));
});

test("Sync now records a new time; a disconnected CRM cannot sync, import or be mapped", async () => {
  vi.setSystemTime(new Date("2026-10-07T13:00:00.000Z"));
  const response = await api.sync();
  expect(connectionSchema.parse(await response.json())).toMatchObject({
    status: "connected",
    lastSyncedAt: "2026-10-07T13:00:00.000Z",
  });
  expect((await byType("crm")).lastSyncedAt).toBe("2026-10-07T13:00:00.000Z");

  await disconnect("crm");
  expect((await byType("crm")).stageMapping).toBeNull();
  for (const call of [api.sync, api.import, api.getMapping, api.putMapping]) {
    const refused = await call();
    expect(refused.status).toBe(409);
    expect(await code(refused)).toBe("conflict");
  }
});

test("a saved stage mapping shows in a later read, and survives a disconnect and reconnect", async () => {
  const response = await api.putMapping();
  expect(response.status).toBe(200);
  expect(stageMappingSchema.parse(await response.json()).mapping).toEqual(
    SWAPPED,
  );
  expect((await getStageMapping()).mapping).toEqual(SWAPPED);
  expect((await byType("crm")).stageMapping?.mapping).toEqual(SWAPPED);

  await disconnect("crm");
  await connect("crm", { apiKey: KEY });
  expect((await byType("crm")).stageMapping?.mapping).toEqual(SWAPPED);
});

test("an import reports every sample lead as already here and none added, however often it runs (spec 09, rule 1)", async () => {
  const leads = (await listVisibleLeads()).length;
  expect(leads).toBeGreaterThan(0);
  for (let run = 0; run < 2; run += 1) {
    const response = await api.import();
    expect(response.status).toBe(200);
    expect(importResultSchema.parse(await response.json())).toEqual({
      found: leads,
      added: 0,
      alreadyHere: leads,
    });
  }
  expect((await listVisibleLeads()).length).toBe(leads);
});

test("what a caller is given is a copy: changing it does not change the store", async () => {
  const given = await listConnections();
  given[0].provider.name = "Changed";
  given[0].status = "not_connected";
  if (given[0].stageMapping) given[0].stageMapping.mapping.won = "Changed";
  const fresh = await byType("crm");
  expect(fresh.provider.name).toBe(CRM_PROVIDERS[0].name);
  expect(fresh.status).toBe("connected");
  expect(fresh.stageMapping?.mapping.won).toBe("Won");
});

// --- credentials never leave (spec 09, rule 6) -----------------------------------

const LOOKS_LIKE_A_KEY = /key|secret|token|credential|password|vault|bearer/i;

/** Every property name and every text value in a JSON body, however deep. */
function walk(value: unknown, names: string[] = [], texts: string[] = []) {
  if (typeof value === "string") texts.push(value);
  else if (Array.isArray(value))
    for (const item of value) walk(item, names, texts);
  else if (value && typeof value === "object") {
    for (const [name, inner] of Object.entries(value)) {
      names.push(name);
      walk(inner, names, texts);
    }
  }
  return { names, texts };
}

test("no response of any route contains a credential, a reference to one, or the key that was sent", async () => {
  const logs = (["log", "info", "warn", "error", "debug"] as const).map(
    (level) => vi.spyOn(console, level).mockImplementation(() => {}),
  );
  const connectSpy = vi.spyOn(crm, "connect");

  // Every route, on its happy path and on each kind of refusal, with the key in play.
  const responses = [
    await api.list(),
    await api.connect("invoices"),
    await api.connect("invoices"), // 409
    await api.connect("invoices", { apiKey: KEY, extra: KEY }), // 400
    await api.connect("email"), // 400
    await api.disconnect("crm"),
    await api.connect("crm"),
    await api.sync(),
    await api.import(),
    await api.getMapping(),
    await api.putMapping(),
    await api.putMapping({ ...SWAPPED, won: KEY }), // 409
    await api.disconnect("decks"),
    await api.list(),
  ];
  viewAs("staff");
  responses.push(await api.connect("decks"), await api.list()); // 403

  expect(responses.map((response) => response.status)).toEqual([
    200, 200, 409, 400, 400, 200, 200, 200, 200, 200, 200, 409, 200, 200, 403,
    403,
  ]);
  for (const response of responses) {
    const text = await response.text();
    expect(text).not.toContain(KEY);
    if (!response.ok) continue;
    const { names, texts } = walk(JSON.parse(text));
    expect(names.filter((name) => LOOKS_LIKE_A_KEY.test(name))).toEqual([]);
    expect(texts.filter((value) => LOOKS_LIKE_A_KEY.test(value))).toEqual([]);
  }

  // The key reached the service once and went nowhere else: not a log line,
  // and not the store (a later read is what the store holds, minus the reference).
  expect(connectSpy).toHaveBeenCalledExactlyOnceWith(KEY);
  for (const log of logs) expect(log).not.toHaveBeenCalled();
  viewAs("owner");
  expect(JSON.stringify(await listConnections())).not.toMatch(LOOKS_LIKE_A_KEY);
});

test("the service makes no network call", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  await disconnect("crm");
  await connect("crm", { apiKey: KEY });
  await syncNow("crm");
  await importLeads();
  await saveStageMapping(SWAPPED);
  await listConnections();
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

// --- brand names live in one table -----------------------------------------------

test("no file of these two screens names a provider by brand, except the provider table", () => {
  const brands = new RegExp(
    [
      ...CRM_PROVIDERS.map((provider) => provider.name),
      ...Object.values(FIXED_PROVIDERS).map((provider) => provider.name),
      "\\bGHL\\b",
      "HighLevel",
    ].join("|"),
    "i",
  );
  const files = [
    "src/lib/connections/schemas.ts",
    "src/lib/connections/rules.ts",
    "src/lib/services/crm.ts",
    "src/lib/data/connections.ts",
    "src/lib/data/fixtures/connections.ts",
    "src/lib/queries/connections.ts",
    "src/hooks/use-connections.ts",
    "src/app/dashboard/_components/integrations-screen.tsx",
    "src/app/dashboard/integrations/page.tsx",
    "src/app/api/connections/route.ts",
    "src/app/api/connections/[type]/route.ts",
    "src/app/api/connections/[type]/sync/route.ts",
    "src/app/api/connections/[type]/import/route.ts",
    "src/app/api/connections/[type]/stage-mapping/route.ts",
    "src/lib/workspace/schemas.ts",
    "src/lib/workspace/rules.ts",
    "src/lib/data/workspace.ts",
    "src/lib/data/fixtures/workspace.ts",
    "src/hooks/use-workspace.ts",
    "src/app/dashboard/_components/workspace-screen.tsx",
    "src/app/dashboard/settings/page.tsx",
  ];
  for (const file of files) {
    expect(readFileSync(file, "utf8").match(brands), file).toBeNull();
  }
  expect(readFileSync("src/lib/connections/providers.ts", "utf8")).toMatch(
    brands,
  );
});
