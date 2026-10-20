// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET as getViewerRoute } from "@/app/api/viewer/route";
import {
  getLead,
  getPipelineSummary,
  listLeads,
  listVisibleLeads,
  markLost,
  recordDeckTemplate,
  recordInvoiceDraft,
  recordProposalStatus,
} from "@/lib/data/leads";
import { resetSampleData } from "@/lib/data/sample";
import {
  leadScope,
  type Profile,
  requireAdmin,
  requireProfile,
} from "@/lib/data/users";
import { getViewerSummary } from "@/lib/data/viewer";
import { listLeadsQuerySchema } from "@/lib/leads/schemas";
import { viewerSchema } from "@/lib/roles";
import {
  fake,
  resetFakes,
  SAMPLE_REP,
  signIn,
  viewAs,
} from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);

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
  signIn();
  fake.users.set(ada.id, ada);
});
afterEach(() => vi.useRealTimers());

const everyLead = () =>
  listLeads(listLeadsQuerySchema.parse({ tab: "open", limit: "100" }));
const refusedWith = (code: string) => expect.objectContaining({ code });

// --- the guards (spec 01 section 4) --------------------------------------------

test("requireProfile: signed out is 401, no profile is 403, a deactivated profile is 403, else the profile", async () => {
  expect(await requireProfile()).toEqual({
    ...ada,
    role: "admin",
    active: true,
  });

  fake.users.set(ada.id, { ...ada, active: false });
  await expect(requireProfile()).rejects.toEqual(refusedWith("forbidden"));
  fake.users.clear();
  await expect(requireProfile()).rejects.toEqual(
    refusedWith("profile_required"),
  );
  fake.claims = null;
  await expect(requireProfile()).rejects.toEqual(
    refusedWith("unauthenticated"),
  );
});

test("requireAdmin: an admin passes, a rep is refused, and a deactivated admin is refused", async () => {
  expect((await requireAdmin()).role).toBe("admin");
  viewAs("rep");
  await expect(requireAdmin()).rejects.toEqual(refusedWith("forbidden"));
  viewAs("admin");
  fake.users.set(ada.id, { ...ada, active: false });
  await expect(requireAdmin()).rejects.toEqual(refusedWith("forbidden"));
});

test("leadScope: an admin reaches every lead (no condition), a rep only the leads assigned to them", () => {
  const profile = (role: Profile["role"]): Profile => ({
    ...ada,
    role,
    active: true,
  });
  expect(leadScope(profile("admin"))).toBeUndefined();
  const scope = leadScope(profile("rep"));
  expect(scope && new PgDialect().sqlToQuery(scope)).toMatchObject({
    sql: '"leads"."assigned_to" = $1',
    params: [ada.id],
  });
});

test("the viewer summary carries the profile's own role, admin or rep", async () => {
  // Leads are real (spec 07): the sample-only controls are off.
  expect(await getViewerSummary()).toEqual({ role: "admin", preview: false });
  viewAs("rep");
  expect(await getViewerSummary()).toEqual({ role: "rep", preview: false });
});

// --- what a role sees of the leads ---------------------------------------------

test("an admin sees every lead; a rep sees only the leads assigned to them, in the list, the counts and the rep filter", async () => {
  const all = await everyLead();
  const summary = await getPipelineSummary({ tz: "UTC" });
  expect(summary.owners.length).toBeGreaterThan(1);

  viewAs("rep");
  const mine = await everyLead();
  expect(mine.total).toBeGreaterThan(0);
  expect(mine.total).toBeLessThan(all.total);
  expect(mine.items.every((lead) => lead.owner.id === SAMPLE_REP.id)).toBe(
    true,
  );

  const repSummary = await getPipelineSummary({ tz: "UTC" });
  expect(repSummary.open).toBe(mine.total);
  expect(repSummary.owners).toEqual([
    { id: SAMPLE_REP.id, name: "Maya Okafor" },
  ]);
  expect(
    (await listVisibleLeads()).every((lead) => lead.owner.id === SAMPLE_REP.id),
  ).toBe(true);
});

test("a rep asking for another rep's lead, or changing it, is told it does not exist, and nothing changes", async () => {
  const other = (await everyLead()).items.find(
    (lead) => lead.owner.id !== SAMPLE_REP.id,
  );
  if (!other) throw new Error("no lead owned by another rep");
  const own = (await everyLead()).items.find(
    (lead) => lead.owner.id === SAMPLE_REP.id,
  );
  if (!own) throw new Error("no lead owned by the sample rep");

  viewAs("rep");
  expect((await getLead(own.id)).id).toBe(own.id);
  await expect(getLead(other.id)).rejects.toEqual(refusedWith("not_found"));
  await expect(markLost(other.id, {})).rejects.toEqual(
    refusedWith("not_found"),
  );

  viewAs("admin");
  expect((await getLead(other.id)).exit).toBeNull();
});

// --- the viewer route ---------------------------------------------------------------

test("GET /api/viewer answers with the role, and 401 when signed out", async () => {
  const response = await getViewerRoute();
  expect(viewerSchema.parse(await response.json()).role).toBe("admin");

  fake.claims = null;
  expect((await getViewerRoute()).status).toBe(401);
});

// --- what the other blocks record on a lead ----------------------------------------

const leadIn = async (tab: string) => {
  const page = await listLeads(
    listLeadsQuerySchema.parse({ tab, limit: "100" }),
  );
  return page.items[0].id;
};

test("sending a proposal moves the lead to Proposal Sent; signing moves it to Lead Won; then an invoice draft can be recorded", async () => {
  const leadId = await leadIn("qualified");

  expect((await recordProposalStatus(leadId, "draft")).stage).toBe("qualified");
  const sent = await recordProposalStatus(leadId, "sent");
  expect(sent).toMatchObject({
    stage: "proposal_sent",
    proposal: { status: "sent" },
  });
  expect(sent.activities[0]).toMatchObject({
    type: "Proposal sent",
    actor: { kind: "user", name: "Ada Lovelace" },
  });

  // Not won yet: there is nothing to invoice.
  await expect(recordInvoiceDraft(leadId)).rejects.toEqual(
    refusedWith("conflict"),
  );

  const viewed = await recordProposalStatus(leadId, "viewed");
  expect(viewed.stage).toBe("proposal_sent");
  expect(viewed.activities[0].actor.kind).toBe("system");

  const signed = await recordProposalStatus(leadId, "signed");
  expect(signed).toMatchObject({
    stage: "won",
    proposal: { status: "signed" },
  });

  const invoiced = await recordInvoiceDraft(leadId);
  expect(invoiced.invoice).toEqual({ status: "draft" });
  expect(invoiced.activities[0].type).toBe("Invoice drafted");
  expect((await getLead(leadId)).invoice).toEqual({ status: "draft" });
});

test("a lead that has left the pipeline takes no proposal change, and a deck's template is recorded on the lead", async () => {
  const gone = await leadIn("lost");
  await expect(recordProposalStatus(gone, "sent")).rejects.toEqual(
    refusedWith("conflict"),
  );

  const withDeck = (await listVisibleLeads()).find((lead) => lead.deck);
  if (!withDeck) throw new Error("no sample lead has a deck");
  const changed = await recordDeckTemplate(withDeck.id, "Review");
  expect(changed.deck?.templateName).toBe("Review");
  expect(changed.activities[0].type).toBe("Deck template changed");

  const withoutDeck = (await listVisibleLeads()).find((lead) => !lead.deck);
  if (!withoutDeck) throw new Error("every sample lead has a deck");
  await expect(recordDeckTemplate(withoutDeck.id, "Review")).rejects.toEqual(
    refusedWith("not_found"),
  );
});
