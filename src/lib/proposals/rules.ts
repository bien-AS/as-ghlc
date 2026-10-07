import { EXIT_LABEL, PROPOSAL_LABEL, type Tone } from "@/lib/leads/rules";
import type { Exit, Stage } from "@/lib/leads/schemas";
import type {
  LineItem,
  Proposal,
  ProposalStatus,
} from "@/lib/proposals/schemas";

/*
 * The rules the builder, Lead detail and the data-access layer share, so the
 * page and the server cannot disagree: the one status-to-tone mapping, when a
 * proposal can be started, edited and sent, and how money is written. Pure
 * functions; no data access.
 */

/** Every proposal status chip takes its word and tone from here. */
export const PROPOSAL_STATUS_META: Record<
  ProposalStatus,
  { label: string; tone: Tone }
> = {
  draft: { label: PROPOSAL_LABEL.draft, tone: "neutral" },
  sent: { label: PROPOSAL_LABEL.sent, tone: "brand" },
  viewed: { label: PROPOSAL_LABEL.viewed, tone: "brand" },
  signed: { label: PROPOSAL_LABEL.signed, tone: "ok" },
  lost: { label: PROPOSAL_LABEL.lost, tone: "crit" },
};

const NOT_STARTED = { label: "Not started", tone: "neutral" } as const;

/** The chip for a lead's proposal, including a lead that has none yet. */
export const proposalStatusMeta = (
  status: ProposalStatus | null | undefined,
): { label: string; tone: Tone } =>
  status ? PROPOSAL_STATUS_META[status] : NOT_STARTED;

/** The stages a proposal belongs to (spec 14: "from a lead in Qualified or Proposal Review Booked", then onwards). */
const PROPOSAL_STAGES: readonly Stage[] = [
  "qualified",
  "review_booked",
  "proposal_sent",
  "won",
];

type Standing = { stage: Stage; exit: Exit | null };

/** Whether a lead is at a point where it can have a proposal at all. */
export const canHaveProposal = (lead: Standing) =>
  !lead.exit && PROPOSAL_STAGES.includes(lead.stage);

/** Why a lead cannot have a proposal yet, in a sentence for the rep. */
export const proposalBlockedReason = (lead: Standing) =>
  lead.exit
    ? `This lead left the pipeline: ${EXIT_LABEL[lead.exit]}. A proposal cannot be started for it.`
    : "A proposal can be started once the lead is Qualified. Record the outcome of the discovery call first.";

/** Only a draft can be edited (spec 14: sent, signed and lost proposals cannot). */
export const canEditProposal = (proposal: Pick<Proposal, "status">) =>
  proposal.status === "draft";

export const totalOf = (lineItems: Pick<LineItem, "price">[]) =>
  Math.round(lineItems.reduce((sum, item) => sum + item.price, 0) * 100) / 100;

/** What still stops a draft from being sent, or null when it can go. */
export function sendBlockedReason(
  proposal: Pick<Proposal, "client" | "lineItems">,
): string | null {
  if (!proposal.lineItems.some((item) => item.price > 0)) {
    return "Add at least one service with a price before sending.";
  }
  if (!proposal.client.email) {
    return "Add the client's email before sending.";
  }
  return null;
}

/** Dollars as the rep and the lead read them: "$1,500" or "$1,499.50". */
export const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
