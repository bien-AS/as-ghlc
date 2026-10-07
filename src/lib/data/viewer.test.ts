// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST as postRole } from "@/app/api/viewer/role/route";
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
  resetSampleLeads,
} from "@/lib/data/leads";
import {
  getViewer,
  getViewerSummary,
  PREVIEW_ROLE_COOKIE,
  PREVIEW_STAFF_REP,
  requireCapability,
  setPreviewRole,
} from "@/lib/data/viewer";
import { listLeadsQuerySchema } from "@/lib/leads/schemas";
import { CAPABILITIES, can, ROLES, viewerSchema } from "@/lib/roles";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
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
  resetSampleLeads();
  signIn();
  fake.users.set(ada.id, ada);
});
afterEach(() => vi.useRealTimers());

const viewAs = (role: string) => fake.cookies.set(PREVIEW_ROLE_COOKIE, role);
const everyLead = () =>
  listLeads(listLeadsQuerySchema.parse({ tab: "open", limit: "100" }));
const refusedWith = (code: string) => expect.objectContaining({ code });

// --- the role ----------------------------------------------------------------

test("with no preview chosen the viewer is an Owner; a preview cookie picks the role; a bad value is ignored", async () => {
  expect((await getViewer()).role).toBe("owner");
  expect(await getViewerSummary()).toEqual({
    role: "owner",
    preview: true,
    staffRep: null,
  });

  viewAs("admin");
  expect((await getViewer()).role).toBe("admin");

  viewAs("staff");
  expect(await getViewer()).toMatchObject({
    role: "staff",
    repId: PREVIEW_STAFF_REP.id,
    user: ada,
  });
  expect((await getViewerSummary()).staffRep).toEqual(PREVIEW_STAFF_REP);

  viewAs("superuser");
  expect((await getViewer()).role).toBe("owner");
});

test("the role is resolved after the real guard: signed out and profile-less callers are refused whatever the cookie says", async () => {
  viewAs("owner");
  fake.users.clear();
  await expect(getViewer()).rejects.toEqual(refusedWith("profile_required"));
  fake.claims = null;
  await expect(getViewer()).rejects.toEqual(refusedWith("unauthenticated"));
  await expect(setPreviewRole({ role: "staff" })).rejects.toEqual(
    refusedWith("unauthenticated"),
  );
});

test("staff can do none of the admin things; admin and owner can do all of them (question 7, proposed)", async () => {
  for (const capability of CAPABILITIES) {
    expect(can("staff", capability)).toBe(false);
    expect(can("admin", capability)).toBe(true);
    expect(can("owner", capability)).toBe(true);

    viewAs("staff");
    await expect(requireCapability(capability)).rejects.toEqual(
      refusedWith("forbidden"),
    );
    viewAs("admin");
    expect((await requireCapability(capability)).role).toBe("admin");
  }
});

test("the staff preview's rep is one of the sample reps, so a Staff view is never empty", async () => {
  const { owners } = await getPipelineSummary({ tz: "UTC" });
  expect(owners).toContainEqual(PREVIEW_STAFF_REP);
});

// --- what a role sees of the leads (spec 12) -------------------------------------

test("an owner and an admin see every lead; staff see only the leads they own, in the list, the counts and the rep filter", async () => {
  const all = await everyLead();
  const summary = await getPipelineSummary({ tz: "UTC" });
  expect(summary.owners.length).toBeGreaterThan(1);

  viewAs("admin");
  expect((await everyLead()).total).toBe(all.total);

  viewAs("staff");
  const mine = await everyLead();
  expect(mine.total).toBeGreaterThan(0);
  expect(mine.total).toBeLessThan(all.total);
  expect(
    mine.items.every((lead) => lead.owner.id === PREVIEW_STAFF_REP.id),
  ).toBe(true);

  const staffSummary = await getPipelineSummary({ tz: "UTC" });
  expect(staffSummary.open).toBe(mine.total);
  expect(staffSummary.owners).toEqual([PREVIEW_STAFF_REP]);
  expect(
    (await listVisibleLeads()).every(
      (lead) => lead.owner.id === PREVIEW_STAFF_REP.id,
    ),
  ).toBe(true);
});

test("staff asking for another rep's lead, or changing it, are told it does not exist, and nothing changes", async () => {
  const other = (await everyLead()).items.find(
    (lead) => lead.owner.id !== PREVIEW_STAFF_REP.id,
  );
  if (!other) throw new Error("no lead owned by another rep");
  const own = (await everyLead()).items.find(
    (lead) => lead.owner.id === PREVIEW_STAFF_REP.id,
  );
  if (!own) throw new Error("no lead owned by the previewed rep");

  viewAs("staff");
  expect((await getLead(own.id)).id).toBe(own.id);
  await expect(getLead(other.id)).rejects.toEqual(refusedWith("not_found"));
  await expect(markLost(other.id, {})).rejects.toEqual(
    refusedWith("not_found"),
  );

  viewAs("owner");
  expect((await getLead(other.id)).exit).toBeNull();
});

// --- the preview's routes ----------------------------------------------------------

const post = (body: unknown) =>
  postRole(
    new Request("http://localhost:3000/api/viewer/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

test("GET /api/viewer answers with the role; POST /api/viewer/role remembers a preview and refuses anything that is not a role", async () => {
  const before = await getViewerRoute();
  expect(viewerSchema.parse(await before.json()).role).toBe("owner");

  for (const role of ROLES) {
    const response = await post({ role });
    expect(response.status).toBe(200);
    expect(viewerSchema.parse(await response.json()).role).toBe(role);
    expect(fake.cookies.get(PREVIEW_ROLE_COOKIE)).toBe(role);
    expect(viewerSchema.parse(await (await getViewerRoute()).json()).role).toBe(
      role,
    );
  }

  for (const bad of [{ role: "root" }, {}, { role: "admin", extra: 1 }]) {
    const response = await post(bad);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_input");
  }
  expect(fake.cookies.get(PREVIEW_ROLE_COOKIE)).toBe("staff");
});

test("signed out, both viewer routes answer 401, and no preview is remembered", async () => {
  fake.claims = null;
  expect((await getViewerRoute()).status).toBe(401);
  expect((await post({ role: "staff" })).status).toBe(401);
  expect(fake.cookies.has(PREVIEW_ROLE_COOKIE)).toBe(false);
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
