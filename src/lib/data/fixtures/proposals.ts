import type { LeadDetail } from "@/lib/leads/schemas";
import { totalOf } from "@/lib/proposals/rules";
import type {
  CatalogueService,
  LineItem,
  Proposal,
  ProposalClient,
} from "@/lib/proposals/schemas";

/*
 * Sample proposals (ADR-0006). Imported by `src/lib/data/proposals.ts` and its
 * tests only. Nothing here comes from the proposal service.
 */

/** A proposal as stored: the contract, plus the proposal service's own id. */
export type ProposalRecord = Proposal & { serviceProposalId: string };

type CatalogueEntry = CatalogueService & {
  /** Words in a lead's form answers that suggest this service. */
  keywords: string[];
};

/**
 * MOCK CHOICE (spec 14: "the list of services, pricing rules" are not
 * specified). An invented catalogue for a marketing agency, each service with
 * one suggested price in dollars. The real list and its pricing come from
 * Authority Solutions; replace this constant, or load it from the Workspace.
 */
export const SERVICE_CATALOGUE: CatalogueEntry[] = [
  {
    id: "local-seo",
    name: "Local SEO",
    description:
      "Search listings, local pages and citations, reported monthly.",
    price: 1500,
    keywords: ["seo", "rank", "search listing"],
  },
  {
    id: "website",
    name: "Website design and build",
    description: "A new site of up to ten pages, written, designed and built.",
    price: 6000,
    keywords: ["website", "web site", "redesign"],
  },
  {
    id: "paid-search",
    name: "Paid search management",
    description:
      "Search ad campaigns set up and managed. Ad spend is separate.",
    price: 1200,
    keywords: ["paid search", "ads", "ppc"],
  },
  {
    id: "reputation",
    name: "Reputation management",
    description: "Review requests, monitoring and replies.",
    price: 800,
    keywords: ["reputation", "review"],
  },
  {
    id: "content",
    name: "Content marketing",
    description: "Four articles a month, planned around what customers ask.",
    price: 1400,
    keywords: ["content", "blog", "article"],
  },
  {
    id: "social",
    name: "Social media management",
    description: "Three posts a week across two networks.",
    price: 900,
    keywords: ["social"],
  },
  {
    id: "retainer",
    name: "Full marketing retainer",
    description: "Search, ads, content and reporting under one monthly plan.",
    price: 7500,
    keywords: ["retainer", "full marketing"],
  },
  {
    id: "reporting",
    name: "Analytics and reporting",
    description: "Call and form tracking with a monthly report.",
    price: 400,
    keywords: ["report", "tracking", "analytics"],
  },
];

const toLineItem = ({
  name,
  description,
  price,
}: CatalogueEntry): LineItem => ({
  service: name,
  description,
  price,
});

/** The most a lead said it would spend, or null when it gave no ceiling. */
function budgetCeiling(budget: string | null): number | null {
  if (!budget || /above|over|more than|\+/i.test(budget)) return null;
  const amounts = (budget.match(/\d[\d,]*/g) ?? []).map((text) =>
    Number(text.replaceAll(",", "")),
  );
  return amounts.length > 0 ? Math.max(...amounts) : null;
}

/**
 * MOCK CHOICE: what "Generate proposal" suggests. Services whose keywords
 * appear in the lead's form answers, then reporting; trimmed from the end
 * while the total is above the budget the lead gave. Local SEO when nothing
 * matches. A stand-in for whatever the real generation turns out to be.
 */
export function suggestLineItems(
  lead: Pick<LeadDetail, "formAnswers" | "budget">,
): LineItem[] {
  const said = lead.formAnswers
    .map(({ answer }) => answer)
    .join(" ")
    .toLowerCase();
  const matched = SERVICE_CATALOGUE.filter((service) =>
    // From the start of a word, so "leads" does not suggest "ads".
    service.keywords.some((keyword) => new RegExp(`\\b${keyword}`).test(said)),
  );
  const chosen = matched.length > 0 ? matched : [SERVICE_CATALOGUE[0]];
  const reporting = SERVICE_CATALOGUE.find(({ id }) => id === "reporting");
  if (reporting && !chosen.includes(reporting)) chosen.push(reporting);

  const budgetAnswer = lead.formAnswers.find(({ question }) =>
    /budget/i.test(question),
  )?.answer;
  const ceiling = budgetCeiling(lead.budget ?? budgetAnswer ?? null);
  const items = chosen.map(toLineItem);
  while (ceiling !== null && items.length > 1 && totalOf(items) > ceiling) {
    items.pop();
  }
  return items;
}

/** The lead's own details, as a proposal's client. */
export const clientOf = (
  lead: Pick<LeadDetail, "name" | "company" | "email">,
): ProposalClient => ({
  name: lead.name,
  company: lead.company ?? "",
  email: lead.email ?? "",
});

/**
 * The proposal a sample lead already has, for a lead whose record says so:
 * built from the lead, at the status the lead carries.
 */
export function buildSampleProposal(
  lead: LeadDetail & { proposal: NonNullable<LeadDetail["proposal"]> },
): ProposalRecord {
  const lineItems = suggestLineItems(lead);
  const { status } = lead.proposal;
  const sent = status !== "draft";
  return {
    id: `proposal-${lead.id}`,
    serviceProposalId: `sample-proposal-${lead.id}`,
    leadId: lead.id,
    client: clientOf(lead),
    lineItems,
    context:
      "Thank you for the conversation. This is the plan we talked through, with a price for each part.",
    status,
    total: totalOf(lineItems),
    sentAt: sent ? lead.updatedAt : null,
    snapshot: sent ? structuredClone(lineItems) : null,
    updatedAt: lead.updatedAt,
  };
}
