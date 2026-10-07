// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET as getInvoiceRoute } from "@/app/api/leads/[leadId]/invoice/route";
import { POST as postGenerate } from "@/app/api/proposals/[leadId]/generate/route";
import {
  GET as getProposalRoute,
  PUT as putProposal,
} from "@/app/api/proposals/[leadId]/route";
import { POST as postSend } from "@/app/api/proposals/[leadId]/send/route";
import { POST as postSimulate } from "@/app/api/proposals/[leadId]/simulate/route";
import { GET as getProposalLeads } from "@/app/api/proposals/route";
import { SERVICE_CATALOGUE } from "@/lib/data/fixtures/proposals";
import { createInvoiceDraft, getInvoice } from "@/lib/data/invoices";
import {
  getLead,
  listVisibleLeads,
  markLost,
  resetSampleLeads,
} from "@/lib/data/leads";
import { createNotification } from "@/lib/data/notifications";
import {
  generateProposal,
  getProposal,
  listProposalLeads,
  saveProposalDraft,
  sendProposal,
  simulateProposalEvent,
} from "@/lib/data/proposals";
import { AccessError } from "@/lib/data/users";
import { PREVIEW_ROLE_COOKIE, PREVIEW_STAFF_REP } from "@/lib/data/viewer";
import { invoiceResponseSchema, invoiceSchema } from "@/lib/invoices/schemas";
import {
  catalogueServiceSchema,
  type ProposalDraftInput,
  proposalLeadsSchema,
  proposalViewSchema,
} from "@/lib/proposals/schemas";
import { toAppStatus } from "@/lib/services/proposal-service";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);
// The real function still runs; the test only watches what it is asked to raise.
vi.mock("@/lib/data/notifications", async (original) => {
  const actual = await original<typeof import("@/lib/data/notifications")>();
  return { ...actual, createNotification: vi.fn(actual.createNotification) };
});
// Sample data can be switched off for one test, to see what is then refused.
const sample = vi.hoisted(() => ({ on: true }));
vi.mock("@/lib/data/sample", async (original) => {
  const actual = await original<typeof import("@/lib/data/sample")>();
  return {
    ...actual,
    get SAMPLE_DATA() {
      return sample.on;
    },
  };
});

const ORIGIN = "http://localhost:3000";
const NOW = "2026-10-07T12:00:00.000Z";
const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(NOW) });
  resetFakes();
  resetSampleLeads();
  signIn();
  fake.users.set(ada.id, ada);
  sample.on = true;
  vi.mocked(createNotification).mockClear();
});
afterEach(() => vi.useRealTimers());

const refusedWith = (code: AccessError["code"]) => new AccessError(code);
const viewAs = (role: string) => fake.cookies.set(PREVIEW_ROLE_COOKIE, role);

/** The id of the sample lead with this name. */
async function idOf(name: string) {
  const lead = (await listVisibleLeads()).find((item) => item.name === name);
  if (!lead) throw new Error(`no sample lead called ${name}`);
  return lead.id;
}

const DRAFT: ProposalDraftInput = {
  client: {
    name: "Beatrix Olander",
    company: "Olander Chiropractic",
    email: "beatrix@olander.example",
  },
  lineItems: [
    { service: "Local SEO", description: "Monthly.", price: 1450 },
    { service: "Photography day", description: "", price: 899.5 },
  ],
  context: "As discussed on Tuesday.",
};

// --- the routes -------------------------------------------------------------------

const context = (leadId: string) => ({ params: Promise.resolve({ leadId }) });
const request = (method: string, path: string, body?: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method,
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });

const api = {
  leads: () => getProposalLeads(),
  get: (id: string) =>
    getProposalRoute(request("GET", `/api/proposals/${id}`), context(id)),
  put: (id: string, body: unknown = DRAFT) =>
    putProposal(request("PUT", `/api/proposals/${id}`, body), context(id)),
  generate: (id: string, body: unknown = {}) =>
    postGenerate(
      request("POST", `/api/proposals/${id}/generate`, body),
      context(id),
    ),
  send: (id: string, body: unknown = {}) =>
    postSend(request("POST", `/api/proposals/${id}/send`, body), context(id)),
  simulate: (id: string, body: unknown = { event: "viewed" }) =>
    postSimulate(
      request("POST", `/api/proposals/${id}/simulate`, body),
      context(id),
    ),
  invoice: (id: string) =>
    getInvoiceRoute(request("GET", `/api/leads/${id}/invoice`), context(id)),
};

/** Every route, each called with input it would accept. */
const everyRoute = (id: string): [string, () => Promise<Response>][] => [
  ["GET /api/proposals", api.leads],
  ["GET /api/proposals/{id}", () => api.get(id)],
  ["PUT /api/proposals/{id}", () => api.put(id)],
  ["POST /api/proposals/{id}/generate", () => api.generate(id)],
  ["POST /api/proposals/{id}/send", () => api.send(id)],
  ["POST /api/proposals/{id}/simulate", () => api.simulate(id)],
  ["GET /api/leads/{id}/invoice", () => api.invoice(id)],
];

const view = async (response: Response) =>
  proposalViewSchema.parse(await response.json());

test("signed out, every route answers 401; without a profile, 403 profile_required; nothing is changed", async () => {
  const id = await idOf("Beatrix Olander");

  fake.claims = null;
  for (const [name, call] of everyRoute(id)) {
    const response = await call();
    expect(response.status, name).toBe(401);
    expect((await response.json()).error.code, name).toBe("unauthenticated");
  }

  signIn();
  fake.users.clear();
  for (const [name, call] of everyRoute(id)) {
    const response = await call();
    expect(response.status, name).toBe(403);
    expect((await response.json()).error.code, name).toBe("profile_required");
  }

  fake.users.set(ada.id, ada);
  expect((await getProposal(id)).proposal).toBeNull();
});

test("a lead that does not exist answers 404 on every route that names one", async () => {
  for (const [name, call] of everyRoute("lead-999").slice(1)) {
    const response = await call();
    expect(response.status, name).toBe(404);
    expect((await response.json()).error.code, name).toBe("not_found");
  }
});

test("a body that is not the contract is refused with 400 and the fields at fault, and nothing is saved", async () => {
  const id = await idOf("Kwame Asante");
  const before = await getProposal(id);

  const bad: [unknown, string][] = [
    [
      { ...DRAFT, lineItems: [{ ...DRAFT.lineItems[0], price: -1 }] },
      "lineItems",
    ],
    [
      { ...DRAFT, lineItems: [{ ...DRAFT.lineItems[0], price: 1.005 }] },
      "lineItems",
    ],
    [
      { ...DRAFT, lineItems: [{ ...DRAFT.lineItems[0], service: "  " }] },
      "lineItems",
    ],
    [
      { ...DRAFT, lineItems: [{ ...DRAFT.lineItems[0], price: "1200" }] },
      "lineItems",
    ],
    [{ ...DRAFT, client: { ...DRAFT.client, name: "" } }, "client"],
    [
      { ...DRAFT, client: { ...DRAFT.client, email: "not-an-email" } },
      "client",
    ],
    [{ ...DRAFT, context: "x".repeat(2001) }, "context"],
    [{ client: DRAFT.client, lineItems: [] }, "context"],
  ];
  for (const [body, field] of bad) {
    const response = await api.put(id, body);
    expect(response.status, JSON.stringify(body)).toBe(400);
    const { error } = await response.json();
    expect(error.code).toBe("invalid_input");
    expect(error.fields[field]).toBeDefined();
  }
  // An unknown field, a body that is not JSON, and a field no route takes.
  expect((await api.put(id, { ...DRAFT, status: "signed" })).status).toBe(400);
  expect((await api.put(id, "not json")).status).toBe(400);
  expect((await api.send(id, { to: "someone@else.example" })).status).toBe(400);
  expect((await api.generate(id, { services: [] })).status).toBe(400);
  for (const body of [{}, { event: "lost" }, { event: "signed", extra: 1 }]) {
    expect((await api.simulate(id, body)).status).toBe(400);
  }

  expect(await getProposal(id)).toEqual(before);
});

// --- reading ----------------------------------------------------------------------

test("the picker lists the leads from Qualified onwards that are still in the pipeline, with where each proposal stands", async () => {
  const response = await api.leads();
  expect(response.status).toBe(200);
  const leads = proposalLeadsSchema.parse(await response.json());

  const stages = new Set(leads.map((lead) => lead.stage));
  expect([...stages].sort()).toEqual(
    ["proposal_sent", "qualified", "review_booked", "won"].sort(),
  );
  const status = Object.fromEntries(
    leads.map((lead) => [lead.name, lead.proposalStatus]),
  );
  expect(status).toMatchObject({
    "Beatrix Olander": null,
    "Kwame Asante": "draft",
    "Anneliese Brandt": "sent",
    "Thaddeus Okonkwo": "viewed",
    "Jonas Whitlock": "signed",
  });
  // Left the pipeline, or not yet qualified: not offered.
  expect(status).not.toHaveProperty("Seraphina Duarte");
  expect(status).not.toHaveProperty("Sofia Lindgren");
  // The ones with nothing started come first.
  expect(leads[0].proposalStatus).toBeNull();
});

test("every sample proposal and invoice parses against its schema, and neither service's id reaches the client", async () => {
  for (const service of SERVICE_CATALOGUE) {
    expect(catalogueServiceSchema.parse(service).price).toBeGreaterThan(0);
  }

  const leads = await listVisibleLeads();
  let proposals = 0;
  let invoices = 0;
  for (const lead of leads) {
    const response = await api.get(lead.id);
    const body = await response.text();
    const parsed = proposalViewSchema.parse(JSON.parse(body));
    expect(body).not.toMatch(/serviceProposalId|sample-proposal/);
    expect(parsed.proposal?.status ?? null).toBe(lead.proposal?.status ?? null);
    if (parsed.proposal) {
      proposals += 1;
      const { proposal } = parsed;
      expect(proposal.lineItems.length).toBeGreaterThan(0);
      expect(proposal.total).toBe(
        proposal.lineItems.reduce((sum, item) => sum + item.price, 0),
      );
      // The snapshot exists exactly when the proposal has been sent.
      expect(proposal.snapshot !== null).toBe(proposal.status !== "draft");
      expect(proposal.sentAt !== null).toBe(proposal.status !== "draft");
    }

    const invoiceBody = await (await api.invoice(lead.id)).text();
    const invoice = invoiceResponseSchema.parse(JSON.parse(invoiceBody));
    expect(invoiceBody).not.toMatch(/serviceInvoiceId|sample-invoice/);
    expect(invoice?.status ?? null).toBe(lead.invoice?.status ?? null);
    if (invoice) invoices += 1;
  }
  expect(proposals).toBeGreaterThanOrEqual(9);
  expect(invoices).toBe(3);
});

test("a proposal starts from the lead's own details, and its suggested services follow the form answers and the budget", async () => {
  // Asked for paid search, with $2,000 to $4,000 a month.
  const kwame = await getProposal(await idOf("Kwame Asante"));
  expect(kwame.client).toEqual({
    name: "Kwame Asante",
    company: "Asante Solar",
    email: "kwame@asantesolar.example",
  });
  expect(kwame.proposal?.lineItems.map((item) => item.service)).toEqual([
    "Paid search management",
    "Analytics and reporting",
  ]);
  expect(kwame.proposal?.total).toBeLessThanOrEqual(4000);
  expect(kwame.canStart).toBe(false);

  // Asked for local SEO and a new website.
  const beatrix = await generateProposal(await idOf("Beatrix Olander"));
  expect(beatrix.proposal?.lineItems.map((item) => item.service)).toEqual([
    "Local SEO",
    "Website design and build",
    "Analytics and reporting",
  ]);
});

test("a lead's invoice is null until it has one; a won sample lead's draft has one line per line of its signed proposal", async () => {
  expect(await getInvoice(await idOf("Kwame Asante"))).toBeNull();

  const jonas = await idOf("Jonas Whitlock");
  const { proposal } = await getProposal(jonas);
  const invoice = invoiceSchema.parse(await getInvoice(jonas));
  expect(invoice).toMatchObject({
    leadId: jonas,
    proposalId: proposal?.id,
    status: "draft",
    total: proposal?.total,
  });
  expect(invoice.lines).toEqual(
    proposal?.snapshot?.map((item) => ({
      description: item.service,
      amount: item.price,
    })),
  );
  // The same invoice on a second read.
  expect(await getInvoice(jonas)).toEqual(invoice);

  // Nothing signed, nothing to invoice; and never a second draft.
  await expect(createInvoiceDraft(await idOf("Kwame Asante"))).rejects.toEqual(
    refusedWith("conflict"),
  );
  await expect(createInvoiceDraft(jonas)).rejects.toEqual(
    refusedWith("conflict"),
  );
});

// --- the path from draft to signed ----------------------------------------------------

test("generate, edit, send, viewed, signed: the lead moves to Proposal Sent and then Lead Won, and the invoice draft is the snapshot", async () => {
  const id = await idOf("Beatrix Olander");
  const start = await view(await api.get(id));
  expect(start).toMatchObject({ canStart: true, proposal: null });

  // Generate: a draft; the lead says so.
  const generated = await view(await api.generate(id));
  expect(generated.proposal).toMatchObject({ status: "draft", snapshot: null });
  expect(generated.canStart).toBe(false);
  expect((await getLead(id)).proposal).toEqual({ status: "draft" });
  expect((await api.generate(id)).status).toBe(409);

  // Edit: what was saved is what a later read returns, trimmed.
  const saved = await view(
    await api.put(id, {
      ...DRAFT,
      context: `  ${DRAFT.context}  `,
      client: { ...DRAFT.client, name: " Beatrix Olander " },
    }),
  );
  expect(saved.proposal).toMatchObject({ ...DRAFT, total: 2349.5 });
  expect((await getProposal(id)).proposal).toEqual(saved.proposal);
  expect((await getLead(id)).stage).toBe("qualified");

  // Send: the snapshot is taken and the lead moves on.
  const sent = await view(await api.send(id));
  expect(sent.proposal).toMatchObject({
    status: "sent",
    sentAt: NOW,
    snapshot: DRAFT.lineItems,
  });
  expect(sent.lead.stage).toBe("proposal_sent");
  const afterSend = await getLead(id);
  expect(afterSend).toMatchObject({
    stage: "proposal_sent",
    proposal: { status: "sent" },
  });
  expect(afterSend.activities[0].type).toBe("Proposal sent");

  // Sent: no more edits, no second send.
  const refused = await api.put(id, { ...DRAFT, context: "Changed my mind." });
  expect(refused.status).toBe(409);
  expect((await refused.json()).error.code).toBe("conflict");
  expect((await api.send(id)).status).toBe(409);
  expect((await getProposal(id)).proposal?.context).toBe(DRAFT.context);
  expect(await getInvoice(id)).toBeNull();

  // Viewed: the status changes, the stage does not; it is viewed only once.
  const viewed = await view(await api.simulate(id, { event: "viewed" }));
  expect(viewed.proposal?.status).toBe("viewed");
  expect((await getLead(id)).stage).toBe("proposal_sent");
  expect((await api.simulate(id, { event: "viewed" })).status).toBe(409);
  expect((await api.put(id)).status).toBe(409);
  expect(createNotification).not.toHaveBeenCalled();

  // Signed: Lead Won, an invoice draft from the snapshot, two notifications.
  const signed = await view(await api.simulate(id, { event: "signed" }));
  expect(signed.proposal?.status).toBe("signed");
  expect(signed.lead.stage).toBe("won");
  const won = await getLead(id);
  expect(won).toMatchObject({
    stage: "won",
    proposal: { status: "signed" },
    invoice: { status: "draft" },
  });
  expect(won.activities.slice(0, 2).map((activity) => activity.type)).toEqual([
    "Invoice drafted",
    "Proposal signed",
  ]);

  const invoice = invoiceSchema.parse(await (await api.invoice(id)).json());
  expect(invoice).toMatchObject({
    leadId: id,
    proposalId: signed.proposal?.id,
    status: "draft",
    total: 2349.5,
    createdAt: NOW,
  });
  expect(invoice.lines).toEqual([
    { description: "Local SEO", amount: 1450 },
    { description: "Photography day", amount: 899.5 },
  ]);

  expect(vi.mocked(createNotification).mock.calls).toEqual([
    [{ leadId: id, type: "proposal_signed" }],
    [{ leadId: id, type: "invoice_draft_ready" }],
  ]);

  // Signed is final.
  for (const event of ["viewed", "signed"]) {
    expect((await api.simulate(id, { event })).status).toBe(409);
  }
  expect((await api.put(id)).status).toBe(409);
});

test("a sent proposal can be signed without being viewed first", async () => {
  const id = await idOf("Anneliese Brandt");
  const signed = await simulateProposalEvent(id, "signed");
  expect(signed.proposal?.status).toBe("signed");
  expect((await getLead(id)).stage).toBe("won");
  expect((await getInvoice(id))?.lines).toEqual(
    signed.proposal?.snapshot?.map((item) => ({
      description: item.service,
      amount: item.price,
    })),
  );
});

test("a draft cannot be sent without a priced service or without the client's email, and cannot be simulated", async () => {
  const id = await idOf("Kwame Asante");
  await expect(simulateProposalEvent(id, "viewed")).rejects.toEqual(
    refusedWith("conflict"),
  );

  await saveProposalDraft(id, { ...DRAFT, lineItems: [] });
  await expect(sendProposal(id)).rejects.toEqual(refusedWith("conflict"));
  await saveProposalDraft(id, {
    ...DRAFT,
    lineItems: [{ service: "Audit", description: "", price: 0 }],
  });
  await expect(sendProposal(id)).rejects.toEqual(refusedWith("conflict"));
  await saveProposalDraft(id, {
    ...DRAFT,
    client: { ...DRAFT.client, email: "" },
  });
  await expect(sendProposal(id)).rejects.toEqual(refusedWith("conflict"));
  expect((await getLead(id)).stage).toBe("qualified");

  await saveProposalDraft(id, DRAFT);
  expect((await sendProposal(id)).proposal?.status).toBe("sent");
});

test("a lead that is not Qualified yet, or has left the pipeline, takes no proposal and no change to one", async () => {
  const early = await idOf("Sofia Lindgren");
  expect(await getProposal(early)).toMatchObject({
    canStart: false,
    proposal: null,
  });
  expect((await api.generate(early)).status).toBe(409);
  expect((await api.put(early)).status).toBe(409);
  expect((await api.send(early)).status).toBe(409);

  // Lost with a proposal: still readable, as it was.
  const lost = await idOf("Seraphina Duarte");
  const seen = await getProposal(lost);
  expect(seen).toMatchObject({
    canStart: false,
    lead: { exit: "lost" },
    proposal: { status: "lost" },
  });
  expect((await api.put(lost)).status).toBe(409);

  // Marked lost while its proposal was out: nothing more can happen to it.
  const sent = await idOf("Anneliese Brandt");
  await markLost(sent, {});
  for (const call of [api.put, api.send, api.simulate]) {
    expect((await call(sent)).status).toBe(409);
  }
  expect((await getProposal(sent)).proposal?.status).toBe("sent");
});

// --- roles ------------------------------------------------------------------------

test("staff reach only their own leads' proposals and invoices; another rep's answer 404", async () => {
  const all = await listProposalLeads();
  const leads = await listVisibleLeads();
  const ownerOf = (id: string) =>
    leads.find((lead) => lead.id === id)?.owner.id;
  const jonas = await idOf("Jonas Whitlock");
  const kwame = await idOf("Kwame Asante");
  const anneliese = await idOf("Anneliese Brandt");
  const ingrid = await idOf("Ingrid Aaltonen");
  expect(ownerOf(anneliese)).toBe(PREVIEW_STAFF_REP.id);

  viewAs("staff");
  const mine = await listProposalLeads();
  expect(mine.length).toBeGreaterThan(0);
  expect(mine.length).toBeLessThan(all.length);
  expect(mine.every((lead) => ownerOf(lead.id) === PREVIEW_STAFF_REP.id)).toBe(
    true,
  );

  for (const [name, call] of [
    ...everyRoute(kwame).slice(1, 6),
    ...everyRoute(jonas).slice(6),
  ]) {
    const response = await call();
    expect(response.status, name).toBe(404);
  }
  await expect(createInvoiceDraft(jonas)).rejects.toEqual(
    refusedWith("not_found"),
  );

  // Their own: readable, and theirs to act on.
  expect((await api.get(anneliese)).status).toBe(200);
  expect((await api.invoice(ingrid)).status).toBe(200);
  expect((await view(await api.simulate(anneliese))).proposal?.status).toBe(
    "viewed",
  );

  // Nothing of the other rep's changed.
  viewAs("owner");
  expect((await getProposal(kwame)).proposal?.status).toBe("draft");
  expect((await getLead(kwame)).stage).toBe("qualified");
});

// --- what stands in for the proposal service -------------------------------------------

test("once the data is real, nobody can say a lead viewed or signed a proposal", async () => {
  const id = await idOf("Anneliese Brandt");
  sample.on = false;
  const response = await api.simulate(id, { event: "signed" });
  expect(response.status).toBe(403);
  expect((await response.json()).error.code).toBe("forbidden");

  sample.on = true;
  expect((await getProposal(id)).proposal?.status).toBe("sent");
  expect((await getLead(id)).stage).toBe("proposal_sent");
  expect(await getInvoice(id)).toBeNull();
});

test("the proposal service's statuses and events map onto the app's five", () => {
  const report = (
    status: Parameters<typeof toAppStatus>[0]["status"],
    ...events: Parameters<typeof toAppStatus>[0]["events"]
  ) => toAppStatus({ status, events });

  expect(report("draft")).toBe("draft");
  expect(report("sent")).toBe("sent");
  expect(report("sent", "proposal_viewed")).toBe("viewed");
  expect(report("sent", "proposal_viewed", "proposal_signed")).toBe("signed");
  expect(report("won")).toBe("signed");
  expect(report("lost", "proposal_viewed")).toBe("lost");
  expect(report("cancelled")).toBe("lost");
});
