import { AccessError } from "@/lib/data/users";
import type {
  LeadDetail,
  LeadPage,
  ListLeadsQuery,
  ReviewInput,
} from "@/lib/leads/schemas";
import { leadsModule } from "@/test/lead-stand-ins";

/*
 * The six suspect stand-ins (src/test/lead-stand-ins.ts) for the mockup
 * screens and the modules still on sample data of their own (decks,
 * proposals, invoices, notifications): they reach leads only through
 * `getLead`, `listVisibleLeads`, the three `record…` writes and, for the
 * suspect queue, `listLeads` and `reviewSuspect`, which these replace with the
 * same guards and scope. Wire them in with
 *   vi.mock("@/lib/data/leads", async (original) => ({
 *     ...(await original<typeof import("@/lib/data/leads")>()),
 *     ...(await import("@/test/mockup-stand-ins")).mockupLeadsModule,
 *   }));
 * and call `resetStandIns()` in `beforeEach`.
 */

/**
 * Per-test changes laid over a stand-in, e.g. a deck or a later stage, for a
 * test of what a mockup does once a lead carries one. A real lead has none yet.
 */
export const standIns = { patch: new Map<string, Partial<LeadDetail>>() };

export function resetStandIns() {
  standIns.patch.clear();
}

/** The stand-ins the signed-in person may see, with this test's changes. */
async function listVisibleLeads(): Promise<LeadDetail[]> {
  return (await leadsModule.listVisibleLeads()).map((lead) => ({
    ...lead,
    ...structuredClone(standIns.patch.get(lead.id)),
  }));
}

/** One stand-in, refused as `not_found` when it is not the viewer's to see. */
async function getLead(leadId: string): Promise<LeadDetail> {
  const lead = (await listVisibleLeads()).find((item) => item.id === leadId);
  if (!lead) throw new AccessError("not_found");
  return lead;
}

/** As the real ones: the guard, then a conflict until those tables exist. */
async function refuse(leadId: string): Promise<LeadDetail> {
  await getLead(leadId);
  throw new AccessError("conflict");
}

const waiting = (lead: LeadDetail) => lead.verdict === "suspect" && !lead.exit;

/**
 * One page holding every match, oldest first. Only the suspect filter is
 * applied: the suspect queue is the only screen here that lists leads.
 * ponytail: no paging or other filters; the lead list's own tests use the database.
 */
async function listLeads(query: ListLeadsQuery): Promise<LeadPage> {
  const items = (await listVisibleLeads())
    .filter((lead) => query.needs !== "suspects" || waiting(lead))
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name),
    );
  return { items, total: items.length, nextCursor: null };
}

/** A suspect's review: cleared as valid, or out as spam. Decided once. */
async function reviewSuspect(
  leadId: string,
  input: ReviewInput,
): Promise<LeadDetail> {
  const lead = await getLead(leadId);
  if (!waiting(lead)) throw new AccessError("conflict");
  standIns.patch.set(leadId, {
    ...standIns.patch.get(leadId),
    ...(input.outcome === "cleared"
      ? { verdict: "valid" as const }
      : { exit: "spam" as const }),
  });
  return getLead(leadId);
}

/*
 * Every real lead is New, with no proposal, until proposals are read from
 * their table (spec 12). The proposal screens' own sample proposals are
 * reached through stand-ins moved along the pipeline. The sample rep owns the
 * first two; another rep owns the rest.
 */
export const PROPOSAL_LEADS = {
  /** Proposal out. */
  sent: "stand-in-1",
  /** Lost, with a proposal. */
  lost: "stand-in-2",
  /** Qualified, nothing started. */
  qualified: "stand-in-3",
  /** Qualified, a draft. */
  draft: "stand-in-4",
  /** Won: signed, invoice drafted. */
  won: "stand-in-5",
  /** Not qualified yet, as every real lead is today. */
  early: "stand-in-6",
};

/** Moves the stand-ins to where PROPOSAL_LEADS says they are. */
export function moveForProposals() {
  const at: [string, Partial<LeadDetail>][] = [
    [
      PROPOSAL_LEADS.sent,
      { stage: "proposal_sent", proposal: { status: "sent" } },
    ],
    [
      PROPOSAL_LEADS.lost,
      { stage: "proposal_sent", exit: "lost", proposal: { status: "lost" } },
    ],
    [
      PROPOSAL_LEADS.qualified,
      {
        stage: "qualified",
        formAnswers: [
          {
            question: "What do you need?",
            answer: "Local SEO and a new website",
          },
        ],
      },
    ],
    [
      PROPOSAL_LEADS.draft,
      {
        stage: "qualified",
        proposal: { status: "draft" },
        formAnswers: [
          { question: "What do you need?", answer: "Paid search for installs" },
          { question: "Monthly budget", answer: "$2,000 to $4,000" },
        ],
      },
    ],
    [
      PROPOSAL_LEADS.won,
      {
        stage: "won",
        proposal: { status: "signed" },
        invoice: { status: "draft" },
      },
    ],
  ];
  for (const [id, patch] of at) {
    standIns.patch.set(id, { email: `${id}@client.example`, ...patch });
  }
}

export const mockupLeadsModule = {
  ...leadsModule,
  listVisibleLeads,
  getLead,
  listLeads,
  reviewSuspect,
  recordProposalStatus: refuse,
  recordInvoiceDraft: refuse,
  recordDeckTemplate: refuse,
};
