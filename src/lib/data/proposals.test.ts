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
import {
  SERVICE_CATALOGUE,
  suggestLineItems,
} from "@/lib/data/fixtures/proposals";
import { createInvoiceDraft, getInvoice } from "@/lib/data/invoices";
import { getLead, listVisibleLeads } from "@/lib/data/leads";
import { createNotification } from "@/lib/data/notifications";
import {
  generateProposal,
  getProposal,
  listProposalLeads,
  saveProposalDraft,
  sendProposal,
  simulateProposalEvent,
} from "@/lib/data/proposals";
import { resetSampleData } from "@/lib/data/sample";
import { AccessError } from "@/lib/data/users";
import { invoiceResponseSchema, invoiceSchema } from "@/lib/invoices/schemas";
import {
  catalogueServiceSchema,
  type ProposalDraftInput,
  proposalLeadsSchema,
  proposalViewSchema,
} from "@/lib/proposals/schemas";
import { toAppStatus } from "@/lib/services/proposal-service";
import {
  moveForProposals,
  PROPOSAL_LEADS,
  resetStandIns,
} from "@/test/mockup-stand-ins";
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
// Leads live in Postgres; this module reaches them only through these.
vi.mock("@/lib/data/leads", async (original) => ({
  ...(await original<typeof import("@/lib/data/leads")>()),
  ...(await import("@/test/mockup-stand-ins")).mockupLeadsModule,
}));
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

// Stand-ins moved along the pipeline (src/test/mockup-stand-ins.ts): a real
// lead has no proposal until proposals are read from their table (spec 12).
const {
  sent: ANNELIESE,
  lost: SERAPHINA,
  qualified: BEATRIX,
  draft: KWAME,
  won: JONAS,
  early: SOFIA,
} = PROPOSAL_LEADS;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(NOW) });
  resetFakes();
  resetSampleData();
  resetStandIns();
  moveForProposals();
  signIn();
  fake.users.set(ada.id, ada);
  sample.on = true;
  vi.mocked(createNotification).mockClear();
});
afterEach(() => vi.useRealTimers());

const refusedWith = (code: AccessError["code"]) => new AccessError(code);

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
  fake.claims = null;
  for (const [name, call] of everyRoute(BEATRIX)) {
    const response = await call();
    expect(response.status, name).toBe(401);
    expect((await response.json()).error.code, name).toBe("unauthenticated");
  }

  signIn();
  fake.users.clear();
  for (const [name, call] of everyRoute(BEATRIX)) {
    const response = await call();
    expect(response.status, name).toBe(403);
    expect((await response.json()).error.code, name).toBe("profile_required");
  }

  fake.users.set(ada.id, ada);
  expect((await getProposal(BEATRIX)).proposal).toBeNull();
});

test("a lead that does not exist answers 404 on every route that names one", async () => {
  for (const [name, call] of everyRoute("lead-999").slice(1)) {
    const response = await call();
    expect(response.status, name).toBe(404);
    expect((await response.json()).error.code, name).toBe("not_found");
  }
});

test("a body that is not the contract is refused with 400 and the fields at fault, and nothing is saved", async () => {
  const before = await getProposal(KWAME);

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
    const response = await api.put(KWAME, body);
    expect(response.status, JSON.stringify(body)).toBe(400);
    const { error } = await response.json();
    expect(error.code).toBe("invalid_input");
    expect(error.fields[field]).toBeDefined();
  }
  // An unknown field, a body that is not JSON, and a field no route takes.
  expect((await api.put(KWAME, { ...DRAFT, status: "signed" })).status).toBe(
    400,
  );
  expect((await api.put(KWAME, "not json")).status).toBe(400);
  expect((await api.send(KWAME, { to: "someone@else.example" })).status).toBe(
    400,
  );
  expect((await api.generate(KWAME, { services: [] })).status).toBe(400);
  for (const body of [{}, { event: "lost" }, { event: "signed", extra: 1 }]) {
    expect((await api.simulate(KWAME, body)).status).toBe(400);
  }

  expect(await getProposal(KWAME)).toEqual(before);
});

// --- reading ----------------------------------------------------------------------

test("with real leads, all New and without a proposal, the picker is empty and none can be started", async () => {
  resetStandIns();
  expect(proposalLeadsSchema.parse(await (await api.leads()).json())).toEqual(
    [],
  );
  expect(await view(await api.get(BEATRIX))).toMatchObject({
    canStart: false,
    proposal: null,
  });
  expect((await api.generate(BEATRIX)).status).toBe(409);
  expect(await (await api.invoice(BEATRIX)).json()).toBeNull();
});

test("the picker lists the leads from Qualified onwards that are still in the pipeline, with where each proposal stands", async () => {
  const response = await api.leads();
  expect(response.status).toBe(200);
  const leads = proposalLeadsSchema.parse(await response.json());

  const stages = new Set(leads.map((lead) => lead.stage));
  expect([...stages].sort()).toEqual(
    ["proposal_sent", "qualified", "won"].sort(),
  );
  const status = Object.fromEntries(
    leads.map((lead) => [lead.id, lead.proposalStatus]),
  );
  expect(status).toEqual({
    [BEATRIX]: null,
    [KWAME]: "draft",
    [ANNELIESE]: "sent",
    [JONAS]: "signed",
  });
  // Left the pipeline, or not yet qualified: not offered.
  expect(status).not.toHaveProperty(SERAPHINA);
  expect(status).not.toHaveProperty(SOFIA);
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
  expect(proposals).toBe(4);
  expect(invoices).toBe(1);
});

test("a proposal starts from the lead's own details, and its suggested services follow the form answers and the budget", async () => {
  // Asked for paid search, with $2,000 to $4,000 a month.
  const kwame = await getProposal(KWAME);
  expect(kwame.client).toEqual({
    name: "Stand-in 4",
    company: "Company 4",
    email: `${KWAME}@client.example`,
  });
  expect(kwame.proposal?.lineItems.map((item) => item.service)).toEqual([
    "Paid search management",
    "Analytics and reporting",
  ]);
  expect(kwame.proposal?.total).toBeLessThanOrEqual(4000);
  expect(kwame.canStart).toBe(false);

  // Asked for local SEO and a new website: what Generate would suggest.
  const beatrix = await getProposal(BEATRIX);
  expect(beatrix.canStart).toBe(true);
  expect(
    suggestLineItems(await getLead(BEATRIX)).map((item) => item.service),
  ).toEqual([
    "Local SEO",
    "Website design and build",
    "Analytics and reporting",
  ]);
});

test("a lead's invoice is null until it has one; a won sample lead's draft has one line per line of its signed proposal", async () => {
  expect(await getInvoice(KWAME)).toBeNull();

  const { proposal } = await getProposal(JONAS);
  const invoice = invoiceSchema.parse(await getInvoice(JONAS));
  expect(invoice).toMatchObject({
    leadId: JONAS,
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
  expect(await getInvoice(JONAS)).toEqual(invoice);

  // Nothing signed, nothing to invoice; and never a second draft.
  await expect(createInvoiceDraft(KWAME)).rejects.toEqual(
    refusedWith("conflict"),
  );
  await expect(createInvoiceDraft(JONAS)).rejects.toEqual(
    refusedWith("conflict"),
  );
});

// --- the path from draft to signed ----------------------------------------------------

test("until proposals have their own table, generate and send are refused and the lead does not move; a draft can still be edited", async () => {
  expect(await view(await api.get(BEATRIX))).toMatchObject({
    canStart: true,
    proposal: null,
  });

  // Generate: the lead's record cannot say "draft" yet, so nothing is stored.
  const generated = await api.generate(BEATRIX);
  expect(generated.status).toBe(409);
  expect((await generated.json()).error.code).toBe("conflict");
  await expect(generateProposal(BEATRIX)).rejects.toEqual(
    refusedWith("conflict"),
  );
  expect((await getProposal(BEATRIX)).proposal).toBeNull();

  // Edit: what was saved is what a later read returns, trimmed.
  const saved = await view(
    await api.put(KWAME, {
      ...DRAFT,
      context: `  ${DRAFT.context}  `,
      client: { ...DRAFT.client, name: " Beatrix Olander " },
    }),
  );
  expect(saved.proposal).toMatchObject({ ...DRAFT, total: 2349.5 });
  expect((await getProposal(KWAME)).proposal).toEqual(saved.proposal);

  // Send: refused before anything changes.
  expect((await api.send(KWAME)).status).toBe(409);
  expect((await getProposal(KWAME)).proposal).toEqual(saved.proposal);
  expect((await getLead(KWAME)).stage).toBe("qualified");
  expect(await getInvoice(KWAME)).toBeNull();
  expect(createNotification).not.toHaveBeenCalled();
});

test("a sent proposal cannot be marked viewed or signed while the lead's record cannot follow", async () => {
  for (const event of ["viewed", "signed"] as const) {
    await expect(simulateProposalEvent(ANNELIESE, event)).rejects.toEqual(
      refusedWith("conflict"),
    );
  }
  expect((await getProposal(ANNELIESE)).proposal?.status).toBe("sent");
  expect((await getLead(ANNELIESE)).stage).toBe("proposal_sent");
  expect(await getInvoice(ANNELIESE)).toBeNull();
  expect(createNotification).not.toHaveBeenCalled();
});

test("a draft cannot be sent without a priced service or without the client's email, and cannot be simulated", async () => {
  await expect(simulateProposalEvent(KWAME, "viewed")).rejects.toEqual(
    refusedWith("conflict"),
  );

  await saveProposalDraft(KWAME, { ...DRAFT, lineItems: [] });
  await expect(sendProposal(KWAME)).rejects.toEqual(refusedWith("conflict"));
  await saveProposalDraft(KWAME, {
    ...DRAFT,
    lineItems: [{ service: "Audit", description: "", price: 0 }],
  });
  await expect(sendProposal(KWAME)).rejects.toEqual(refusedWith("conflict"));
  await saveProposalDraft(KWAME, {
    ...DRAFT,
    client: { ...DRAFT.client, email: "" },
  });
  await expect(sendProposal(KWAME)).rejects.toEqual(refusedWith("conflict"));
  expect((await getLead(KWAME)).stage).toBe("qualified");
  expect((await getProposal(KWAME)).proposal?.status).toBe("draft");
});

test("a lead that is not Qualified yet, or has left the pipeline, takes no proposal and no change to one", async () => {
  expect(await getProposal(SOFIA)).toMatchObject({
    canStart: false,
    proposal: null,
  });
  expect((await api.generate(SOFIA)).status).toBe(409);
  expect((await api.put(SOFIA)).status).toBe(409);
  expect((await api.send(SOFIA)).status).toBe(409);

  // Lost with a proposal: still readable, as it was, and nothing more happens to it.
  expect(await getProposal(SERAPHINA)).toMatchObject({
    canStart: false,
    lead: { exit: "lost" },
    proposal: { status: "lost" },
  });
  for (const call of [api.put, api.send, api.simulate]) {
    expect((await call(SERAPHINA)).status).toBe(409);
  }
  expect((await getProposal(SERAPHINA)).proposal?.status).toBe("lost");
});

// --- roles ------------------------------------------------------------------------

test("a rep reaches only their own leads' proposals and invoices; another rep's answer 404", async () => {
  const all = await listProposalLeads();
  const leads = await listVisibleLeads();
  const ownerOf = (id: string) =>
    leads.find((lead) => lead.id === id)?.owner?.id;
  expect(ownerOf(ANNELIESE)).toBe(SAMPLE_REP.id);

  viewAs("rep");
  const mine = await listProposalLeads();
  expect(mine.map((lead) => lead.id)).toEqual([ANNELIESE]);
  expect(mine.length).toBeLessThan(all.length);

  for (const [name, call] of [
    ...everyRoute(KWAME).slice(1, 6),
    ...everyRoute(JONAS).slice(6),
  ]) {
    const response = await call();
    expect(response.status, name).toBe(404);
  }
  // A rep cannot act on invoices at all (spec 01), whoever's lead it is.
  await expect(createInvoiceDraft(JONAS)).rejects.toEqual(
    refusedWith("forbidden"),
  );

  // Their own: readable, and past the guard (refused only as every lead is).
  expect((await api.get(ANNELIESE)).status).toBe(200);
  expect((await api.invoice(ANNELIESE)).status).toBe(200);
  expect((await api.simulate(ANNELIESE)).status).toBe(409);

  // Nothing of the other rep's changed.
  viewAs("admin");
  expect((await getProposal(KWAME)).proposal?.status).toBe("draft");
  expect((await getLead(KWAME)).stage).toBe("qualified");
});

// --- what stands in for the proposal service -------------------------------------------

test("once the data is real, nobody can say a lead viewed or signed a proposal", async () => {
  sample.on = false;
  const response = await api.simulate(ANNELIESE, { event: "signed" });
  expect(response.status).toBe(403);
  expect((await response.json()).error.code).toBe("forbidden");

  sample.on = true;
  expect((await getProposal(ANNELIESE)).proposal?.status).toBe("sent");
  expect((await getLead(ANNELIESE)).stage).toBe("proposal_sent");
  expect(await getInvoice(ANNELIESE)).toBeNull();
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
