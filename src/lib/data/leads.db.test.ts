// @vitest-environment node
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import * as schema from "@/db/schema";
import { getDashboard } from "@/lib/data/dashboard";
import {
  archiveLead,
  assignRep,
  changeStatus,
  getLead,
  listLeads,
  markSpam,
  reviewSuspect,
  setQualification,
} from "@/lib/data/leads";
import { listStatusDefs } from "@/lib/data/status-defs";
import { nextStep } from "@/lib/leads/rules";
import {
  dashboardSchema,
  leadDetailSchema,
  leadPageSchema,
  listLeadsQuerySchema,
  statusDefSchema,
} from "@/lib/leads/schemas";
import { writeQualification } from "@/lib/services/ghl/writes";
import { TEST_IDS } from "@/test/ghl-ids";
import {
  SETUP_TIMEOUT,
  testTransaction,
} from "@/test/isolation/test-transaction";
import { resetFakes, signIn } from "@/test/server-fakes";

/*
 * Lead data access on the real database (spec 07): sorting (check 2), the
 * actions and the one sync-log entry each GHL write leaves (check 3), the
 * list's filters and the dashboard. Everything runs in one transaction that is
 * rolled back; writes to GHL are off and `fetch` throws, so nothing leaves.
 * Who sees what is the isolation suite's (src/test/isolation).
 */

const DIRECT_URL = process.env.DIRECT_URL;
const SUITE = DIRECT_URL
  ? "lead data access (real database)"
  : "lead data access: SKIPPED, DIRECT_URL is not set";

const tx = vi.hoisted(() => ({ db: undefined as unknown as object }));
vi.mock("@/db/client", () => ({
  db: new Proxy(
    {},
    {
      get: (_target, key) => {
        const value = Reflect.get(tx.db, key);
        return typeof value === "function" ? value.bind(tx.db) : value;
      },
    },
  ),
}));
vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);

const ADMIN = {
  id: randomUUID(),
  email: "leads-admin@authoritysolutions.com",
  firstName: "Leads",
  lastName: "Admin",
  role: "admin" as const,
};
const REP = {
  id: randomUUID(),
  email: "leads-rep@authoritysolutions.com",
  firstName: "Leads",
  lastName: "Rep",
  role: "rep" as const,
};
/** In every seeded lead's company, so a search finds only this suite's leads. */
const TAG = `leadsdb${randomUUID().slice(0, 8)}`;
const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

type Db = NodePgDatabase<typeof schema>;

describe.skipIf(!DIRECT_URL)(SUITE, () => {
  let transaction: ReturnType<typeof testTransaction> | undefined;
  let db: Db;

  const seed = async (
    values: Partial<typeof schema.leads.$inferInsert> = {},
  ) => {
    const [lead] = await db
      .insert(schema.leads)
      .values({
        ghlContactId: `leads-db-${randomUUID()}`,
        ghlOpportunityId: `leads-db-${randomUUID()}`,
        firstName: "Lead",
        lastName: randomUUID().slice(0, 6),
        companyName: `${TAG} Co`,
        stage: "New Lead",
        verdict: "valid",
        ...values,
      })
      .returning();
    return lead;
  };

  /** A lead whose discovery call was yesterday: ready for Qualify / Not qualified. */
  const afterCall = () =>
    seed({
      stage: "Discovery Call Booked",
      discoveryBookingAt: ago(24),
      discoveryBookingStatus: "booked",
    });

  const syncRows = (leadId: string) =>
    db
      .select()
      .from(schema.ghlSyncLog)
      .where(eq(schema.ghlSyncLog.leadId, leadId));
  const events = (leadId: string) =>
    db
      .select()
      .from(schema.leadStatusEvents)
      .where(eq(schema.leadStatusEvents.leadId, leadId));

  const list = async (query: Record<string, string> = {}) =>
    leadPageSchema.parse(
      await listLeads(
        listLeadsQuerySchema.parse({ q: TAG, limit: "100", ...query }),
      ),
    ).items;

  beforeAll(async () => {
    transaction = testTransaction(DIRECT_URL as string, "leads:data");
    await transaction.ready;
    db = drizzle({ client: transaction.client, schema });
    tx.db = db;
    for (const { id, email } of [ADMIN, REP]) {
      await transaction.client.query(
        "insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')",
        [id, email],
      );
    }
    await db.insert(schema.profiles).values([ADMIN, REP]);
  }, SETUP_TIMEOUT);

  afterAll(() => transaction?.rollback());

  beforeEach(() => {
    resetFakes();
    signIn({ sub: ADMIN.id, email: ADMIN.email });
    vi.stubEnv("GHL_WRITES_ENABLED", "false");
    vi.stubEnv("GHL_LOCATION_ID", "loc-test");
    vi.stubEnv("GHL_IDS", JSON.stringify(TEST_IDS));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("no request may leave a test");
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("the Lead Status picklist is status_defs' 28 values, in GHL's order", async () => {
    const defs = statusDefSchema.array().parse(await listStatusDefs());
    expect(defs).toHaveLength(28);
    const positions = defs.map((status) => status.position);
    expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    expect(defs[0]).toEqual({
      value: "New - Contacted",
      group: "New",
      position: 0,
      tone: "neutral",
    });
  });

  test("sorting by age or next booking puts never-measured leads last, in both directions (check 2)", async () => {
    const old = await seed({ lastActivityAt: ago(48) });
    const recent = await seed({ lastActivityAt: ago(1) });
    const never = await seed({ lastActivityAt: null });
    const ids = async (sort: string, dir: string) =>
      (await list({ sort, dir }))
        .map((lead) => lead.id)
        .filter((id) => [old.id, recent.id, never.id].includes(id));

    // Youngest first, then oldest first; never measured last both times.
    expect(await ids("age", "asc")).toEqual([recent.id, old.id, never.id]);
    expect(await ids("age", "desc")).toEqual([old.id, recent.id, never.id]);
    const item = (await list()).find((lead) => lead.id === never.id);
    expect(item?.lastActivityAt).toBeNull();

    const soon = await seed({
      discoveryBookingAt: new Date(Date.now() + HOUR),
      discoveryBookingStatus: "booked",
    });
    const later = await seed({
      reviewBookingAt: new Date(Date.now() + 5 * HOUR),
      reviewBookingStatus: "booked",
    });
    const booked = async (dir: string) =>
      (await list({ sort: "next_booking", dir })).map((lead) => lead.id);
    const asc = await booked("asc");
    const desc = await booked("desc");
    expect(asc.slice(0, 2)).toEqual([soon.id, later.id]);
    expect(desc.slice(0, 2)).toEqual([later.id, soon.id]);
    // Every lead with no booking comes after both, either way.
    expect(asc.indexOf(never.id)).toBeGreaterThan(1);
    expect(desc.indexOf(never.id)).toBeGreaterThan(1);
  });

  test.each([
    ["qualified", "Qualified"],
    ["not_qualified", "Lead Lost"],
  ] as const)(
    "%s writes W3 once: one skipped sync-log row, linked from its timeline entry (check 3)",
    async (decision, stage) => {
      const lead = await afterCall();
      const detail = leadDetailSchema.parse(
        await setQualification(lead.id, { decision }),
      );

      const [row, ...more] = await syncRows(lead.id);
      expect(more).toEqual([]);
      expect(row).toMatchObject({
        writeType: "w3_qualification",
        result: "skipped",
        lastError: "writes disabled",
        attempts: 0,
      });
      const [event] = await events(lead.id);
      expect(event).toMatchObject({
        actor: "user",
        actorId: ADMIN.id,
        fromStage: "Discovery Call Booked",
        toStage: stage,
        syncLogId: row.id,
      });
      expect(row.idempotencyKey).toBe(
        `w3_qualification:${lead.id}:${decision}:${event.id}`,
      );
      expect(detail.syncLog.map((entry) => entry.id)).toEqual([row.id]);
      expect(detail.lastSync?.id).toBe(row.id);
      expect(detail.activities[0]).toMatchObject({
        id: event.id,
        actor: { kind: "user", name: "Leads Admin" },
      });

      // The same request again finds the decision made: refused, nothing written.
      await expect(setQualification(lead.id, { decision })).rejects.toThrow(
        "conflict",
      );
      // The same decision id through the write path again: still one row.
      await writeQualification(
        { id: lead.id, ghlOpportunityId: lead.ghlOpportunityId as string },
        decision,
        event.id,
      );
      expect(await syncRows(lead.id)).toHaveLength(1);
      expect(await events(lead.id)).toHaveLength(1);
    },
  );

  test("mark spam writes W4 once, linked from its timeline entry; a second press is refused (check 3)", async () => {
    const lead = await seed({ verdict: "suspect" });
    const detail = await markSpam(lead.id);
    expect(detail).toMatchObject({ verdict: "spam", exit: "spam" });

    const [row, ...more] = await syncRows(lead.id);
    expect(more).toEqual([]);
    expect(row).toMatchObject({ writeType: "w4_mark_spam", result: "skipped" });
    const [event] = await events(lead.id);
    expect(event).toMatchObject({ syncLogId: row.id, note: "Marked as spam" });

    await expect(markSpam(lead.id)).rejects.toThrow("conflict");
    expect(await syncRows(lead.id)).toHaveLength(1);
  });

  test("the review queue cannot mark a won suspect spam: refused, nothing written", async () => {
    const lead = await seed({ verdict: "suspect", stage: "Lead Won" });
    await expect(reviewSuspect(lead.id, { outcome: "spam" })).rejects.toThrow(
      "conflict",
    );
    expect(await syncRows(lead.id)).toEqual([]);
    expect(await events(lead.id)).toEqual([]);
  });

  test("the list's next step is the one lead detail shows: a held call reads Qualified in both", async () => {
    const lead = await afterCall();
    const item = (await list()).find((row) => row.id === lead.id);
    if (!item) throw new Error("the lead is not listed");
    const detail = await getLead(lead.id);
    expect(nextStep(item)).toEqual(nextStep(detail));
    expect(nextStep(item).main).toBe("qualify");
  });

  test("clearing a suspect writes W1 Valid once and records the human run", async () => {
    const lead = await seed({ verdict: "suspect" });
    await db.insert(schema.validationRuns).values({
      leadId: lead.id,
      source: "model",
      verdict: "suspect",
      summary: "Unclear business.",
      reasons: ["No website"],
    });
    const detail = await reviewSuspect(lead.id, { outcome: "cleared" });
    expect(detail.verdict).toBe("valid");
    expect(detail.verdictRecord).toMatchObject({
      result: "suspect",
      summary: "Unclear business.",
      reviewOutcome: "cleared",
      reviewedBy: "Leads Admin",
    });
    const rows = await syncRows(lead.id);
    expect(rows.map((row) => row.writeType)).toEqual(["w1_verdict"]);
    expect((await events(lead.id))[0].syncLogId).toBe(rows[0].id);
    await expect(
      reviewSuspect(lead.id, { outcome: "cleared" }),
    ).rejects.toThrow("conflict");
  });

  test("change status, assign rep and archive write the app only: a timeline entry, no sync-log row", async () => {
    const lead = await seed({ leadStatus: "New - Uncontacted" });

    const changed = await changeStatus(lead.id, { status: "New - Contacted" });
    expect(changed.status).toEqual({
      value: "New - Contacted",
      group: "New",
      tone: "neutral",
    });
    await expect(
      changeStatus(lead.id, { status: "Not a status" }),
    ).rejects.toThrow("conflict");

    const assigned = await assignRep(lead.id, { profileId: REP.id });
    expect(assigned.owner).toEqual({ id: REP.id, name: "Leads Rep" });
    await expect(
      assignRep(lead.id, { profileId: randomUUID() }),
    ).rejects.toThrow("conflict");

    const archived = await archiveLead(lead.id, { reason: "Duplicate" });
    expect(archived.archivedAt).not.toBeNull();
    expect(archived.archivedReason).toBe("Duplicate");

    expect(await syncRows(lead.id)).toEqual([]);
    const notes = (await events(lead.id)).map((event) => [
      event.actor,
      event.toStatus,
      event.note,
    ]);
    expect(notes).toEqual(
      expect.arrayContaining([
        ["user", "New - Contacted", "Lead Status changed"],
        ["user", "New - Contacted", "Assigned to Leads Rep"],
        ["user", "New - Contacted", "Archived"],
      ]),
    );
    // An archived lead takes no further action.
    await expect(archiveLead(lead.id, {})).rejects.toThrow("conflict");
    await expect(markSpam(lead.id)).rejects.toThrow("conflict");
  });

  test("the list filters by stage, verdict, Lead Status group and archived, from the address", async () => {
    // Its own company name, so the other tests' leads stay out of these lists.
    const companyName = `filters${TAG} Co`;
    const lost = await seed({ companyName, stage: "Lead Lost" });
    const nurture = await seed({ companyName, stage: "Nurturing" });
    const suspect = await seed({
      companyName,
      verdict: "suspect",
      stage: "Qualified",
    });
    const grouped = await seed({
      companyName,
      leadStatus: "Engaging - Hot Lead",
    });
    const gone = await seed({ companyName });
    await archiveLead(gone.id, {});
    const ids = async (query: Record<string, string>) =>
      (await list({ q: `filters${TAG}`, ...query })).map((lead) => lead.id);

    expect(await ids({ tab: "lost" })).toEqual([lost.id]);
    expect(await ids({ tab: "nurture" })).toEqual([nurture.id]);
    expect(await ids({ tab: "qualified", verdict: "suspect" })).toEqual([
      suspect.id,
    ]);
    expect(await ids({ group: "Engaging" })).toEqual([grouped.id]);
    const open = await ids({});
    expect(open).not.toContain(lost.id);
    expect(open).not.toContain(gone.id);
    expect(await ids({ archived: "true" })).toEqual([gone.id]);

    const [item] = await list({ q: `filters${TAG}`, tab: "lost" });
    expect(item).toMatchObject({ stage: null, exit: "lost", owner: null });
  });

  test("the dashboard counts live, and a lead with a call soon and no deck needs you", async () => {
    const call = await seed({
      discoveryBookingAt: new Date(Date.now() + 2 * HOUR),
      discoveryBookingStatus: "booked",
    });
    const dashboard = dashboardSchema.parse(await getDashboard({ tz: "UTC" }));
    expect(dashboard.callsNext48h).toBeGreaterThanOrEqual(1);
    expect(dashboard.needsYou).toContainEqual({
      lead: { id: call.id, name: `${call.firstName} ${call.lastName}` },
      reason: "call_without_deck",
      time: call.discoveryBookingAt?.toISOString(),
    });
    // No status has a threshold yet (spec 14), so none is past one.
    expect(
      dashboard.needsYou.filter((item) => item.reason === "past_threshold"),
    ).toEqual([]);
  });

  test("an unknown or malformed lead id is not found", async () => {
    await expect(getLead(randomUUID())).rejects.toThrow("not_found");
    await expect(getLead("lead-01")).rejects.toThrow("not_found");
    await expect(markSpam("lead-01")).rejects.toThrow("not_found");
  });
});
