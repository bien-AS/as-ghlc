// @vitest-environment node
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import * as schema from "@/db/schema";
import {
  getAccountPreferences,
  mutedNotificationTypes,
  updateAccountPreferences,
} from "@/lib/data/account";
import {
  connect,
  disconnect,
  getStageMapping,
  importLeads,
  listConnections,
  saveStageMapping,
  syncNow,
} from "@/lib/data/connections";
import { getDashboard } from "@/lib/data/dashboard";
import {
  getBookingSlots,
  getDeck,
  getDeckPdf,
  listDecks,
  switchTemplate,
  updateSlide,
} from "@/lib/data/decks";
import { requestGhlImport } from "@/lib/data/ghl";
import { createInvoiceDraft, getInvoice } from "@/lib/data/invoices";
import {
  archiveLead,
  assignRep,
  changeStatus,
  getLead,
  getPipelineSummary,
  listLeads,
  listVisibleLeads,
  markSpam,
  recordDeckTemplate,
  recordInvoiceDraft,
  recordProposalStatus,
  reviewSuspect,
  setQualification,
} from "@/lib/data/leads";
import {
  changeMemberRole,
  inviteMember,
  listMembers,
  removeMember,
  resendInvite,
  revokeInvite,
} from "@/lib/data/members";
import {
  createNotification,
  getUnreadCount,
  listNotifications,
  markNotificationRead,
} from "@/lib/data/notifications";
import {
  generateProposal,
  getProposal,
  listProposalLeads,
  saveProposalDraft,
  sendProposal,
  simulateProposalEvent,
} from "@/lib/data/proposals";
import {
  estimateResearchCost,
  getLatestResearch,
  requestResearch,
} from "@/lib/data/research";
import { resetSampleData } from "@/lib/data/sample";
import { listStatusDefs } from "@/lib/data/status-defs";
import { listSyncLog, retryWrite } from "@/lib/data/sync-log";
import { getMe, updateProfile } from "@/lib/data/users";
import { getViewerSummary } from "@/lib/data/viewer";
import { listWebhookEvents } from "@/lib/data/webhook-events";
import { listLeadsQuerySchema, UNASSIGNED } from "@/lib/leads/schemas";
import { listNotificationsQuerySchema } from "@/lib/notifications/schemas";
import type { ProposalDraftInput } from "@/lib/proposals/schemas";
import { resetFakes, signIn } from "@/test/server-fakes";

import { SETUP_TIMEOUT, testTransaction } from "./test-transaction";

/*
 * The data-access isolation suite (spec 01 section 4, acceptance check 4;
 * spec 07 check 1). Real database, three seeded profiles (an admin, rep A and
 * rep B) and three seeded leads (rep A's, rep B's and an unassigned one). They
 * are written inside one transaction that is rolled back at the end, and the
 * app's `db` is bound to that transaction, so nothing is ever committed. Only
 * the Supabase session is faked. Writes to GHL are off, as everywhere.
 */

const DIRECT_URL = process.env.DIRECT_URL;
/** Without a database the suite is skipped, and its name says why. */
const SUITE = DIRECT_URL
  ? "data-access isolation (real database)"
  : "data-access isolation: SKIPPED, DIRECT_URL is not set";

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
  email: "isolation-admin@authoritysolutions.com",
  firstName: "Isolation",
  lastName: "Admin",
  role: "admin" as const,
};
const REP_A = {
  id: randomUUID(),
  email: "isolation-rep-a@authoritysolutions.com",
  firstName: "Rep",
  lastName: "A",
  role: "rep" as const,
};
const REP_B = {
  id: randomUUID(),
  email: "isolation-rep-b@authoritysolutions.com",
  firstName: "Rep",
  lastName: "B",
  role: "rep" as const,
};

const signInAs = (profile: { id: string; email: string }) =>
  signIn({
    sub: profile.id,
    email: profile.email,
    amr: [{ method: "oauth", timestamp: 1 }],
  });

type Calls = Record<string, () => Promise<unknown>>;

/** What each call did: "allowed", or the refusal's code. */
async function outcomes(calls: Calls) {
  const result: Record<string, string> = {};
  for (const [name, call] of Object.entries(calls)) {
    result[name] = await call().then(
      () => "allowed",
      (error) => error?.code ?? String(error),
    );
  }
  return result;
}

const every = (calls: Calls, code: string) =>
  Object.fromEntries(Object.keys(calls).map((name) => [name, code]));

const leadsQuery = (extra: Record<string, string> = {}) =>
  listLeadsQuerySchema.parse({ limit: "100", ...extra });
const notificationsQuery = () =>
  listNotificationsQuerySchema.parse({ limit: "100" });

/** Every list of lead-owned data. */
const listCalls = (): Calls => ({
  listVisibleLeads,
  listLeads: () => listLeads(leadsQuery()),
  getPipelineSummary: () => getPipelineSummary({ tz: "UTC" }),
  getDashboard: () => getDashboard({ tz: "UTC" }),
  listDecks,
  listProposalLeads,
  listNotifications: () => listNotifications(notificationsQuery()),
  getUnreadCount,
  estimateResearchCost,
  listStatusDefs,
});

/** Every read or write of one lead, or of something that belongs to it. */
const leadCalls = (leadId: string, notificationId: string): Calls => ({
  getLead: () => getLead(leadId),
  reviewSuspect: () => reviewSuspect(leadId, { outcome: "cleared" }),
  setQualification: () => setQualification(leadId, { decision: "qualified" }),
  markSpam: () => markSpam(leadId),
  changeStatus: () => changeStatus(leadId, { status: "New - Contacted" }),
  archiveLead: () => archiveLead(leadId, {}),
  recordProposalStatus: () => recordProposalStatus(leadId, "sent"),
  recordInvoiceDraft: () => recordInvoiceDraft(leadId),
  recordDeckTemplate: () => recordDeckTemplate(leadId, "Review"),
  getDeck: () => getDeck(leadId),
  updateSlide: () =>
    updateSlide(leadId, "slide-1", { heading: "x", body: "", bullets: [] }),
  switchTemplate: () => switchTemplate(leadId, { template: "review" }),
  getBookingSlots: () => getBookingSlots(leadId),
  getDeckPdf: () => getDeckPdf(leadId),
  getProposal: () => getProposal(leadId),
  generateProposal: () => generateProposal(leadId),
  saveProposalDraft: () =>
    saveProposalDraft(leadId, {
      client: { name: "x", company: "", email: "" },
      lineItems: [],
      context: "",
    } satisfies ProposalDraftInput),
  sendProposal: () => sendProposal(leadId),
  simulateProposalEvent: () => simulateProposalEvent(leadId, "viewed"),
  getInvoice: () => getInvoice(leadId),
  createNotification: () =>
    createNotification({ leadId, type: "proposal_signed" }),
  markNotificationRead: () => markNotificationRead(notificationId),
  getLatestResearch: () => getLatestResearch(leadId),
  requestResearch: () => requestResearch(leadId),
});

/** The admin cluster: reps, integrations, the GHL sync log, and assigning a lead. */
const adminCalls = (leadId: string): Calls => ({
  listMembers,
  inviteMember: () =>
    inviteMember({ email: "new@isolation.test", role: "rep" }),
  changeMemberRole: () => changeMemberRole("user-x", "rep"),
  removeMember: () => removeMember("user-x"),
  revokeInvite: () => revokeInvite("invite-x"),
  resendInvite: () => resendInvite("invite-x"),
  listConnections,
  connect: () => connect("crm", { apiKey: "key" }),
  disconnect: () => disconnect("crm"),
  syncNow: () => syncNow("crm"),
  importLeads,
  getStageMapping,
  saveStageMapping: () => saveStageMapping({} as never),
  requestGhlImport,
  listSyncLog: () => listSyncLog({}),
  retryWrite: () => retryWrite(randomUUID()),
  listWebhookEvents: () => listWebhookEvents({}),
  assignRep: () => assignRep(leadId, { profileId: null }),
});

/** A person's own things. */
const ownCalls = (): Calls => ({
  getMe,
  updateProfile: () => updateProfile({ firstName: "x", lastName: "y" }),
  getAccountPreferences,
  updateAccountPreferences: () =>
    updateAccountPreferences({ notifications: {} } as never),
  mutedNotificationTypes,
  getViewerSummary,
});

/** A booked discovery call an hour from now: inside the dashboard's 48 hours. */
const soon = () => ({
  discoveryBookingAt: new Date(Date.now() + 60 * 60 * 1000),
  discoveryBookingStatus: "booked" as const,
});

describe.skipIf(!DIRECT_URL)(SUITE, () => {
  let transaction: ReturnType<typeof testTransaction> | undefined;
  let db: NodePgDatabase<typeof schema>;
  /** Rep A's and rep B's suspects, and a suspect nobody is assigned to. */
  let aLead: string;
  let bLead: string;
  let freeLead: string;
  const notificationOf = (leadId: string) => `ntf-${leadId}-suspect_to_review`;

  /** A suspect in New Lead with a call booked soon, imported with one timeline entry. */
  async function seedLead(assignedTo: string | null) {
    const [lead] = await db
      .insert(schema.leads)
      .values({
        ghlContactId: `isolation-${randomUUID()}`,
        ghlOpportunityId: `isolation-${randomUUID()}`,
        firstName: "Isolation",
        lastName: assignedTo === REP_A.id ? "A" : assignedTo ? "B" : "Free",
        stage: "New Lead",
        verdict: "suspect",
        assignedTo,
        lastActivityAt: new Date(),
        ...soon(),
      })
      .returning({ id: schema.leads.id });
    await db.insert(schema.leadStatusEvents).values({
      leadId: lead.id,
      toStage: "New Lead",
      actor: "import",
      note: "imported",
    });
    return lead.id;
  }

  /** The sync-log rows of the three seeded leads: nothing a refusal may write. */
  const syncRows = () =>
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.ghlSyncLog)
      .where(
        sql`${schema.ghlSyncLog.leadId} in (${aLead}, ${bLead}, ${freeLead})`,
      );

  beforeAll(async () => {
    transaction = testTransaction(
      DIRECT_URL as string,
      "isolation:data-access",
    );
    const { client } = transaction;
    await transaction.ready;
    db = drizzle({ client, schema });
    tx.db = db;
    for (const { id, email } of [ADMIN, REP_A, REP_B]) {
      // Supabase's auth users, fake addresses, rolled back with everything else.
      await client.query(
        "insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')",
        [id, email],
      );
    }
    await db.insert(schema.profiles).values([ADMIN, REP_A, REP_B]);
    aLead = await seedLead(REP_A.id);
    bLead = await seedLead(REP_B.id);
    freeLead = await seedLead(null);
  }, SETUP_TIMEOUT);

  afterAll(() => transaction?.rollback());

  beforeEach(() => {
    resetFakes();
    resetSampleData();
  });

  test("rep A's lists, counts, dashboard and activity hold only rep A's leads", async () => {
    signInAs(REP_A);
    const mine = (await listVisibleLeads()).map((lead) => lead.id);
    expect(mine).toEqual([aLead]);

    const dashboard = await getDashboard({ tz: "UTC" });
    const ids = {
      listLeads: (await listLeads(leadsQuery())).items.map((lead) => lead.id),
      suspectQueue: (
        await listLeads(leadsQuery({ needs: "suspects" }))
      ).items.map((lead) => lead.id),
      listDecks: (await listDecks()).map((deck) => deck.lead.id),
      listProposalLeads: (await listProposalLeads()).map((lead) => lead.id),
      listNotifications: (
        await listNotifications(notificationsQuery())
      ).items.map((item) => item.lead.id),
      needsYou: dashboard.needsYou.map((item) => item.lead.id),
      activity: dashboard.activity.map((item) => item.lead.id),
    };
    for (const [list, leadIds] of Object.entries(ids)) {
      expect(
        leadIds.filter((id) => id !== aLead),
        `${list} shows another rep's lead`,
      ).toEqual([]);
    }
    expect(ids.listLeads).toEqual([aLead]);
    expect(ids.needsYou).toContain(aLead);
    expect(ids.activity).toEqual([aLead]);
    expect(dashboard).toMatchObject({
      newThisWeek: 1,
      suspects: 1,
      callsNext48h: 1,
    });

    const summary = await getPipelineSummary({ tz: "UTC" });
    expect(summary.owners).toEqual([{ id: REP_A.id, name: "Rep A" }]);
    expect(summary).toMatchObject({ open: 1, needs: { suspects: 1 } });
  });

  test("the rep filter is the admins': a rep asking for rep B's or unassigned leads still gets only their own", async () => {
    signInAs(REP_A);
    for (const owner of [REP_B.id, UNASSIGNED, "not-a-uuid"]) {
      const { items, total } = await listLeads(leadsQuery({ owner }));
      expect(
        items.map((lead) => lead.id),
        owner,
      ).toEqual([aLead]);
      expect(total).toBe(1);
    }
  });

  test("rep A can neither read nor change rep B's lead, nor anything that belongs to it", async () => {
    signInAs(ADMIN);
    const before = await getLead(bLead);
    const [{ n: syncBefore }] = await syncRows();

    signInAs(REP_A);
    const calls = leadCalls(bLead, notificationOf(bLead));
    expect(await outcomes(calls)).toEqual(every(calls, "not_found"));
    // Assigning is the admins' whatever the lead.
    await expect(assignRep(bLead, { profileId: REP_A.id })).rejects.toThrow(
      "forbidden",
    );
    // An unassigned lead is no rep's.
    await expect(getLead(freeLead)).rejects.toThrow("not_found");

    signInAs(ADMIN);
    expect(await getLead(bLead)).toEqual(before);
    expect((await syncRows())[0].n).toBe(syncBefore);
  });

  test("an admin reaches every rep's leads and the unassigned ones, filters by rep, and reaches the admin cluster", async () => {
    signInAs(ADMIN);
    const all = (await listVisibleLeads()).map((lead) => lead.id);
    expect(all).toEqual(expect.arrayContaining([aLead, bLead, freeLead]));

    const byRep = async (owner: string) =>
      (await listLeads(leadsQuery({ owner }))).items.map((lead) => lead.id);
    expect(await byRep(REP_B.id)).toEqual([bLead]);
    expect(await byRep(REP_A.id)).toEqual([aLead]);
    const unassigned = await byRep(UNASSIGNED);
    expect(unassigned).toContain(freeLead);
    expect(unassigned).not.toContain(aLead);
    expect(unassigned).not.toContain(bLead);

    const dashboard = await getDashboard({ tz: "UTC" });
    expect(dashboard.needsYou.map((item) => item.lead.id)).toEqual(
      expect.arrayContaining([aLead, bLead, freeLead]),
    );
    const owners = (await getPipelineSummary({ tz: "UTC" })).owners.map(
      (owner) => owner.id,
    );
    expect(owners).toEqual(expect.arrayContaining([REP_A.id, REP_B.id]));

    await expect(getLead(bLead)).resolves.toMatchObject({ id: bLead });
    await expect(listMembers()).resolves.toBeInstanceOf(Array);
    await expect(listConnections()).resolves.toBeInstanceOf(Array);
    await expect(listWebhookEvents({})).resolves.toHaveProperty("items");
  });

  test("a rep cannot act on invoices, assign a lead or change its status, and reads only their own lead's", async () => {
    signInAs(ADMIN);
    const before = await getLead(aLead);
    signInAs(REP_A);
    const calls: Calls = {
      createInvoiceDraft: () => createInvoiceDraft(aLead),
      simulateSignature: () => simulateProposalEvent(aLead, "signed"),
      assignRep: () => assignRep(aLead, { profileId: REP_B.id }),
      // Spec 07 question 2: no Lead Status is a rep's to set yet.
      changeStatus: () => changeStatus(aLead, { status: "New - Contacted" }),
    };
    expect(await outcomes(calls)).toEqual(every(calls, "forbidden"));
    await expect(getInvoice(aLead)).resolves.toBeNull();

    signInAs(ADMIN);
    expect(await getLead(aLead)).toEqual(before);
  });

  test("a rep is refused the admin cluster", async () => {
    signInAs(REP_A);
    const calls = adminCalls(aLead);
    expect(await outcomes(calls)).toEqual(every(calls, "forbidden"));
  });

  test("a deactivated profile is refused everywhere, even on its own leads", async () => {
    await db
      .update(schema.profiles)
      .set({ active: false })
      .where(eq(schema.profiles.id, REP_A.id));
    try {
      signInAs(REP_A);
      const calls: Calls = {
        ...listCalls(),
        ...leadCalls(aLead, notificationOf(aLead)),
        createInvoiceDraft: () => createInvoiceDraft(aLead),
        ...adminCalls(aLead),
        ...ownCalls(),
      };
      expect(await outcomes(calls)).toEqual(every(calls, "forbidden"));
    } finally {
      await db
        .update(schema.profiles)
        .set({ active: true })
        .where(eq(schema.profiles.id, REP_A.id));
    }
  });

  test("signed out is refused everywhere", async () => {
    const calls: Calls = {
      ...listCalls(),
      ...leadCalls(aLead, notificationOf(aLead)),
      createInvoiceDraft: () => createInvoiceDraft(aLead),
      ...adminCalls(aLead),
      ...ownCalls(),
    };
    expect(await outcomes(calls)).toEqual(every(calls, "unauthenticated"));
  });
});
