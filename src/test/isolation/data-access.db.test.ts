// @vitest-environment node
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
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
import {
  getBookingSlots,
  getDeck,
  getDeckPdf,
  listDecks,
  switchTemplate,
  updateSlide,
} from "@/lib/data/decks";
import { SAMPLE_REPS } from "@/lib/data/fixtures/leads";
import { requestGhlImport } from "@/lib/data/ghl";
import { createInvoiceDraft, getInvoice } from "@/lib/data/invoices";
import {
  getLead,
  getPipelineSummary,
  listLeads,
  listVisibleLeads,
  markLost,
  markSpam,
  recordDeckTemplate,
  recordInvoiceDraft,
  recordProposalStatus,
  resetSampleLeads,
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
import { getMe, updateProfile } from "@/lib/data/users";
import { getViewerSummary } from "@/lib/data/viewer";
import { listLeadsQuerySchema } from "@/lib/leads/schemas";
import { listNotificationsQuerySchema } from "@/lib/notifications/schemas";
import type { ProposalDraftInput } from "@/lib/proposals/schemas";
import { resetFakes, signIn } from "@/test/server-fakes";

/*
 * The data-access isolation suite (spec 01 section 4, acceptance check 4).
 * Real database, three seeded profiles: an admin, rep A and rep B. They are
 * written inside one transaction that is rolled back at the end, and the app's
 * `db` is bound to that transaction, so nothing is ever committed. Rep A and
 * rep B take the ids of the first two sample reps, so the sample leads (still
 * fixtures, ADR-0006) are assigned to them. Only the Supabase session is faked.
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
  id: SAMPLE_REPS[0].id,
  email: "isolation-rep-a@authoritysolutions.com",
  firstName: "Rep",
  lastName: "A",
  role: "rep" as const,
};
const REP_B = {
  id: SAMPLE_REPS[1].id,
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

const leadsQuery = () => listLeadsQuerySchema.parse({ limit: "100" });
const notificationsQuery = () =>
  listNotificationsQuerySchema.parse({ limit: "100" });

/** Every list of lead-owned data. */
const listCalls = (): Calls => ({
  listVisibleLeads,
  listLeads: () => listLeads(leadsQuery()),
  getPipelineSummary: () => getPipelineSummary({ tz: "UTC" }),
  listDecks,
  listProposalLeads,
  listNotifications: () => listNotifications(notificationsQuery()),
  getUnreadCount,
});

/** Every read or write of one lead, or of something that belongs to it. */
const leadCalls = (
  leadId: string,
  notificationId: string,
  slideId: string,
): Calls => ({
  getLead: () => getLead(leadId),
  reviewSuspect: () => reviewSuspect(leadId, { outcome: "cleared" }),
  setQualification: () => setQualification(leadId, { decision: "qualified" }),
  markLost: () => markLost(leadId, {}),
  markSpam: () => markSpam(leadId),
  recordProposalStatus: () => recordProposalStatus(leadId, "sent"),
  recordInvoiceDraft: () => recordInvoiceDraft(leadId),
  recordDeckTemplate: () => recordDeckTemplate(leadId, "Review"),
  getDeck: () => getDeck(leadId),
  updateSlide: () =>
    updateSlide(leadId, slideId, { heading: "x", body: "", bullets: [] }),
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
});

/** The admin cluster: reps and integrations. */
const adminCalls = (): Calls => ({
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

describe.skipIf(!DIRECT_URL)(SUITE, () => {
  let client: pg.Client | undefined;
  let db: NodePgDatabase<typeof schema>;
  /** Rep B's lead, with a deck, still in the pipeline, and one of its notifications. */
  let bLead: string;
  let bNotification: string;
  /** Rep A's own lead and notification, for the calls that must still be refused. */
  let aLead: string;
  let aNotification: string;
  let bSlide: string;
  let aSlide: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DIRECT_URL });
    await client.connect();
    await client.query("begin");
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
  });

  afterAll(async () => {
    await client?.query("rollback");
    await client?.end();
  });

  beforeEach(async () => {
    resetFakes();
    resetSampleLeads();
    signInAs(ADMIN);
    const leads = await listVisibleLeads();
    const notifications = (await listNotifications(notificationsQuery())).items;
    const pick = (rep: string) => {
      const owned = new Set(
        leads.filter((lead) => lead.owner.id === rep).map((lead) => lead.id),
      );
      const lead = leads.find(
        (candidate) =>
          owned.has(candidate.id) && candidate.deck && !candidate.exit,
      );
      const notification = notifications.find((item) =>
        owned.has(item.lead.id),
      );
      if (!lead || !notification) throw new Error(`no sample data for ${rep}`);
      return [lead.id, notification.id] as const;
    };
    [bLead, bNotification] = pick(REP_B.id);
    [aLead, aNotification] = pick(REP_A.id);
    bSlide = (await getDeck(bLead)).slides[0].id;
    aSlide = (await getDeck(aLead)).slides[0].id;
    resetFakes();
  });

  test("rep A's lists hold only rep A's leads", async () => {
    signInAs(REP_A);
    const own = (await listVisibleLeads()).map((lead) => lead.owner.id);
    expect(own.length).toBeGreaterThan(0);
    expect(new Set(own)).toEqual(new Set([REP_A.id]));

    const mine = new Set(
      (await listVisibleLeads()).map((lead) => lead.id) as string[],
    );
    const ids = {
      listLeads: (await listLeads(leadsQuery())).items.map((lead) => lead.id),
      listDecks: (await listDecks()).map((deck) => deck.lead.id),
      listProposalLeads: (await listProposalLeads()).map((lead) => lead.id),
      listNotifications: (
        await listNotifications(notificationsQuery())
      ).items.map((item) => item.lead.id),
    };
    for (const [list, leadIds] of Object.entries(ids)) {
      expect(
        leadIds.filter((id) => !mine.has(id)),
        `${list} shows another rep's lead`,
      ).toEqual([]);
    }
    expect((await getPipelineSummary({ tz: "UTC" })).owners).toEqual([
      { id: REP_A.id, name: SAMPLE_REPS[0].name },
    ]);
  });

  test("rep A can neither read nor change rep B's lead, nor anything that belongs to it", async () => {
    signInAs(ADMIN);
    const before = await getLead(bLead);
    signInAs(REP_A);
    const calls = leadCalls(bLead, bNotification, bSlide);
    expect(await outcomes(calls)).toEqual(every(calls, "not_found"));

    signInAs(ADMIN);
    expect(await getLead(bLead)).toEqual(before);
  });

  test("an admin reaches every rep's leads and the admin cluster", async () => {
    signInAs(ADMIN);
    const owners = new Set(
      (await listVisibleLeads()).map((lead) => lead.owner.id),
    );
    expect(owners).toContain(REP_A.id);
    expect(owners).toContain(REP_B.id);
    await expect(getLead(bLead)).resolves.toMatchObject({ id: bLead });
    await expect(listMembers()).resolves.toBeInstanceOf(Array);
    await expect(listConnections()).resolves.toBeInstanceOf(Array);
  });

  test("a rep cannot act on invoices, and reads only their own lead's", async () => {
    signInAs(ADMIN);
    const before = await getLead(aLead);
    signInAs(REP_A);
    const calls: Calls = {
      createInvoiceDraft: () => createInvoiceDraft(aLead),
      simulateSignature: () => simulateProposalEvent(aLead, "signed"),
    };
    expect(await outcomes(calls)).toEqual(every(calls, "forbidden"));
    await expect(getInvoice(aLead)).resolves.not.toBeUndefined();

    signInAs(ADMIN);
    expect(await getLead(aLead)).toEqual(before);
  });

  test("a rep is refused the admin cluster", async () => {
    signInAs(REP_A);
    const calls = adminCalls();
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
        ...leadCalls(aLead, aNotification, aSlide),
        createInvoiceDraft: () => createInvoiceDraft(aLead),
        ...adminCalls(),
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
      ...leadCalls(aLead, aNotification, aSlide),
      createInvoiceDraft: () => createInvoiceDraft(aLead),
      ...adminCalls(),
      ...ownCalls(),
    };
    expect(await outcomes(calls)).toEqual(every(calls, "unauthenticated"));
  });
});
