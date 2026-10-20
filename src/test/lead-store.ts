import { AccessError, requireAdmin, requireProfile } from "@/lib/data/users";
import { nextStep } from "@/lib/leads/rules";
import {
  EXITS,
  type LeadDetail,
  type LeadListItem,
  type LeadPage,
  type ListLeadsQuery,
  NEEDS,
  type PipelineSummary,
  STAGES,
  type StatusDef,
  type SyncEntry,
  UNASSIGNED,
} from "@/lib/leads/schemas";
import type { LeadResearch } from "@/lib/research/schemas";
import { SAMPLE_REP } from "@/test/server-fakes";

/*
 * An in-memory lead table for the lead list and lead detail screen tests.
 * Leads live in Postgres (spec 07), which jsdom has not got; this answers the
 * data-access functions' contract (scope by role, the sort orders with nulls
 * last, offset paging, the writes and their sync-log entries with writes off,
 * the Lead Status picklist) so a screen test can run the
 * whole path through the real Route Handlers. Wire it in with
 *   vi.mock("@/lib/data/leads", async (original) => ({
 *     ...(await original<typeof import("@/lib/data/leads")>()),
 *     ...(await import("@/test/lead-store")).leadsModule,
 *   }));
 *   vi.mock("@/lib/data/research", async () => (await import("@/test/lead-store")).researchModule);
 *   vi.mock("@/lib/data/status-defs", async () => (await import("@/test/lead-store")).statusDefsModule);
 * The SQL itself is proven against a real database in src/lib/data/leads.db.test.ts.
 */

export const OTHER_REP = {
  id: "00000000-0000-4000-8000-0000000000b2",
  name: "Jonah Pike",
};
const MAYA = { id: SAMPLE_REP.id, name: "Maya Okafor" };

const DAY = 86_400_000;
/** Times relative to the tests' frozen clock (src/test/dashboard.tsx NOW). */
const NOW = Date.parse("2026-10-07T12:00:00.000Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

const lead = (
  id: string,
  name: string,
  fields: Partial<LeadDetail>,
): LeadDetail => ({
  id,
  name,
  company: `${name.split(" ")[1]} Co`,
  email: `${name.split(" ")[0].toLowerCase()}@example.com`,
  stage: "new",
  exit: null,
  status: { value: "New - Contacted", group: "New", tone: "neutral" },
  verdict: "valid",
  owner: MAYA,
  nextBooking: null,
  createdAt: ago(20),
  lastActivityAt: ago(2),
  archivedAt: null,
  lastSync: null,
  phone: null,
  website: null,
  source: "Get Started form",
  budget: null,
  archivedReason: null,
  formAnswers: [],
  updatedAt: ago(1),
  verdictRecord: {
    result: "valid",
    summary: "A real business with a working site.",
    reasons: [],
    reviewOutcome: null,
    reviewedBy: null,
    reviewedAt: null,
  },
  bookings: [],
  deck: null,
  proposal: null,
  invoice: null,
  activities: [],
  syncLog: [],
  ...fields,
});

const W1: SyncEntry = {
  id: "sync-w1",
  writeType: "w1_verdict",
  result: "succeeded",
  time: ago(5),
  lastError: null,
};

/** The leads, by name. Ages: Imogen 3 days, Desmond 10, Emeka 1; Sofia and Beatrix never synced. */
function build(): LeadDetail[] {
  return [
    lead("lead-imogen", "Imogen Vasquez", {
      stage: "discovery_booked",
      status: {
        value: "Appointment - Completed",
        group: "Appointment",
        tone: "brand",
      },
      lastActivityAt: ago(3),
      bookings: [{ kind: "discovery", time: ago(1), state: "completed" }],
      lastSync: W1,
      syncLog: [W1],
    }),
    lead("lead-sofia", "Sofia Lindgren", {
      owner: OTHER_REP,
      lastActivityAt: null,
    }),
    lead("lead-desmond", "Desmond Achterberg", {
      stage: "qualified",
      status: {
        value: "Qualified - Pending Proposal",
        group: "Qualified",
        tone: "ok",
      },
      lastActivityAt: ago(10),
    }),
    lead("lead-beatrix", "Beatrix Olander", {
      owner: null,
      stage: null,
      status: null,
      verdict: "awaiting",
      verdictRecord: null,
      lastActivityAt: null,
    }),
    lead("lead-emeka", "Emeka Obi", {
      owner: OTHER_REP,
      verdict: "suspect",
      lastActivityAt: ago(1),
    }),
    lead("lead-jonas", "Jonas Whitlock", {
      archivedAt: ago(4),
      archivedReason: "Duplicate",
    }),
  ];
}

let leads = build();
export const research = new Map<string, LeadResearch>();

const BRIEF: LeadResearch = {
  brief: {
    id: "brief-1",
    briefMd:
      "## What they sell\nFamily dentistry in two clinics.\n\n- Reviews mention short waits\n- No paid ads seen",
    facts: {
      summary: "A two-clinic family dental practice.",
      claims: [
        {
          claim: "Runs two clinics in Leeds.",
          source: "https://vasquez.example/locations",
        },
        { claim: "Likely competes on price.", source: "model inference" },
      ],
    },
    model: "test/model",
    inputTokens: 1000,
    outputTokens: 400,
    costUsd: 0.06,
    createdAt: ago(2),
  },
  run: null,
  costEstimate: "≈ $0.06 per run",
};

/** Call in `beforeEach`: the leads as built, and Imogen's ready brief. */
export function resetLeadStore() {
  leads = build();
  research.clear();
  research.set("lead-imogen", structuredClone(BRIEF));
}

/** Adds `count` of Maya's leads, each a day older than the last (20 days and up), for paging. */
export function addLeads(count: number) {
  for (let i = 0; i < count; i += 1) {
    leads.push(
      lead(`lead-extra-${i}`, `Extra Lead${i}`, {
        lastActivityAt: ago(20 + i),
      }),
    );
  }
}

/** For a test to set up a lead's state before it renders. */
export function updateLead(id: string, fields: Partial<LeadDetail>) {
  const found = leads.find((item) => item.id === id);
  if (!found) throw new Error(`no lead ${id}`);
  Object.assign(found, fields);
}

const toItem = ({
  id,
  name,
  company,
  email,
  stage,
  exit,
  status,
  verdict,
  owner,
  nextBooking,
  createdAt,
  lastActivityAt,
  archivedAt,
  lastSync,
}: LeadDetail): LeadListItem => ({
  id,
  name,
  company,
  email,
  stage,
  exit,
  status,
  verdict,
  owner,
  nextBooking,
  createdAt,
  lastActivityAt,
  archivedAt,
  lastSync,
});

async function visible() {
  const viewer = await requireProfile();
  return {
    viewer,
    rows: leads.filter(
      (item) => viewer.role === "admin" || item.owner?.id === viewer.id,
    ),
  };
}

async function find(leadId: string) {
  const { viewer, rows } = await visible();
  const found = rows.find((item) => item.id === leadId);
  if (!found) throw new AccessError("not_found");
  return { viewer, found };
}

const isOpen = (item: LeadDetail) => !item.exit && item.verdict !== "spam";

async function listLeads(query: ListLeadsQuery): Promise<LeadPage> {
  const { viewer, rows } = await visible();
  const owner = viewer.role === "admin" ? query.owner : undefined;
  const q = query.q?.toLowerCase();
  const items = rows
    .filter((item) => Boolean(item.archivedAt) === query.archived)
    .filter((item) =>
      query.tab === "open"
        ? isOpen(item)
        : query.tab === "spam"
          ? item.verdict === "spam"
          : item.stage === query.tab || item.exit === query.tab,
    )
    .filter((item) => !query.verdict || item.verdict === query.verdict)
    .filter(
      (item) =>
        !owner ||
        (owner === UNASSIGNED ? item.owner === null : item.owner?.id === owner),
    )
    .filter((item) => !query.group || item.status?.group === query.group)
    .filter(
      (item) =>
        !q ||
        `${item.name} ${item.company} ${item.email}`.toLowerCase().includes(q),
    )
    .sort(byQuery(query))
    .map(toItem);
  // The cursor is an offset, as in listLeads.
  const start = Number(query.cursor ?? 0);
  const end = start + query.limit;
  return {
    items: structuredClone(items.slice(start, end)),
    nextCursor: end < items.length ? String(end) : null,
    total: items.length,
  };
}

const SORT_KEY: Record<
  ListLeadsQuery["sort"],
  (item: LeadDetail) => string | null
> = {
  recent: (item) => item.updatedAt,
  age: (item) => item.lastActivityAt,
  next_booking: (item) => item.nextBooking?.time ?? null,
};

/** listLeads' order: age runs the other way from its time, and nulls go last both ways. */
function byQuery(query: ListLeadsQuery) {
  const key = SORT_KEY[query.sort];
  const ascending = (query.sort === "age") !== (query.dir === "asc");
  return (a: LeadDetail, b: LeadDetail) => {
    const [x, y] = [key(a), key(b)];
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return x < y === ascending ? -1 : 1;
  };
}

const zero = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

async function getPipelineSummary(): Promise<PipelineSummary> {
  const { viewer, rows } = await visible();
  const active = rows.filter((item) => !item.archivedAt);
  const stages = zero(STAGES);
  const exits = zero(EXITS);
  for (const item of active) {
    if (item.exit) exits[item.exit] += 1;
    else if (item.stage) stages[item.stage] += 1;
  }
  return {
    open: active.filter(isOpen).length,
    stages,
    exits,
    needs: {
      ...zero(NEEDS),
      suspects: active.filter((item) => item.verdict === "suspect").length,
    },
    owners:
      viewer.role === "admin"
        ? [MAYA, OTHER_REP]
        : [{ id: viewer.id, name: `${viewer.firstName} ${viewer.lastName}` }],
  };
}

async function getLead(leadId: string): Promise<LeadDetail> {
  return structuredClone((await find(leadId)).found);
}

async function listVisibleLeads(): Promise<LeadDetail[]> {
  return structuredClone(
    (await visible()).rows.filter((item) => !item.archivedAt),
  );
}

/** With writes off, every write to GHL is recorded as skipped (spec 06). */
function skipped(item: LeadDetail, writeType: SyncEntry["writeType"]) {
  const entry: SyncEntry = {
    id: `sync-${item.syncLog.length + 1}`,
    writeType,
    result: "skipped",
    time: new Date().toISOString(),
    lastError: "writes disabled",
  };
  item.syncLog.unshift(entry);
  item.lastSync = entry;
}

const entry = (type: string, name: string) => ({
  id: `event-${Math.random()}`,
  actor: { kind: "user" as const, name },
  type,
  detail: "",
  time: new Date().toISOString(),
});

async function change(
  leadId: string,
  write: (item: LeadDetail, who: string) => void,
) {
  const { viewer, found } = await find(leadId);
  if (found.archivedAt) throw new AccessError("conflict");
  write(found, `${viewer.firstName} ${viewer.lastName}`);
  return structuredClone(found);
}

async function setQualification(
  leadId: string,
  { decision }: { decision: "qualified" | "not_qualified" },
) {
  return change(leadId, (item, who) => {
    if (!nextStep(item).canQualify) throw new AccessError("conflict");
    skipped(item, "w3_qualification");
    if (decision === "qualified") item.stage = "qualified";
    else {
      item.stage = null;
      item.exit = "lost";
    }
    item.activities.unshift(
      entry(decision === "qualified" ? "Qualified" : "Not qualified", who),
    );
  });
}

async function markSpam(leadId: string) {
  return change(leadId, (item, who) => {
    if (!nextStep(item).canMarkSpam) throw new AccessError("conflict");
    skipped(item, "w4_mark_spam");
    item.verdict = "spam";
    item.exit = "spam";
    item.activities.unshift(entry("Marked as spam", who));
  });
}

async function changeStatus(leadId: string, { status }: { status: string }) {
  const viewer = await requireProfile();
  if (viewer.role !== "admin") throw new AccessError("forbidden");
  return change(leadId, (item, who) => {
    const group = status.split(" - ")[0];
    item.status = { value: status, group, tone: "neutral" };
    item.activities.unshift(entry("Lead Status changed", who));
  });
}

async function assignRep(
  leadId: string,
  { profileId }: { profileId: string | null },
) {
  await requireAdmin();
  return change(leadId, (item, who) => {
    item.owner = [MAYA, OTHER_REP].find((rep) => rep.id === profileId) ?? null;
    item.activities.unshift(entry("Assigned", who));
  });
}

async function archiveLead(leadId: string, { reason }: { reason?: string }) {
  return change(leadId, (item, who) => {
    item.archivedAt = new Date().toISOString();
    item.archivedReason = reason ?? null;
    item.activities.unshift(entry("Archived", who));
  });
}

export const leadsModule = {
  listLeads,
  getPipelineSummary,
  getLead,
  listVisibleLeads,
  setQualification,
  markSpam,
  changeStatus,
  assignRep,
  archiveLead,
};

/** Part of GHL's Lead Status picklist (status_defs), in its order: what the screens use. */
const STATUS_DEFS: StatusDef[] = [
  { value: "New - Contacted", group: "New", position: 0, tone: "neutral" },
  {
    value: "Engaging - Hot Lead",
    group: "Engaging",
    position: 4,
    tone: "brand",
  },
  {
    value: "Appointment - Completed",
    group: "Appointment",
    position: 8,
    tone: "brand",
  },
  {
    value: "Qualified - Pending Proposal",
    group: "Qualified",
    position: 12,
    tone: "ok",
  },
  { value: "Lost - Spam", group: "Lost", position: 26, tone: "crit" },
];

/** Wire in with vi.mock("@/lib/data/status-defs", async () => (await import("@/test/lead-store")).statusDefsModule). */
export const statusDefsModule = {
  listStatusDefs: async () => {
    await requireProfile();
    return structuredClone(STATUS_DEFS);
  },
};

async function getLatestResearch(leadId: string): Promise<LeadResearch> {
  await find(leadId);
  return structuredClone(
    research.get(leadId) ?? {
      brief: null,
      run: null,
      costEstimate: "Not measured",
    },
  );
}

async function requestResearch(leadId: string) {
  await find(leadId);
  const current = await getLatestResearch(leadId);
  research.set(leadId, {
    ...current,
    run: {
      status: "generating",
      error: null,
      createdAt: new Date().toISOString(),
    },
  });
  return { eventId: `research-${leadId}` };
}

export const researchModule = { getLatestResearch, requestResearch };
