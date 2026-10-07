import type { LineItem, ProposalClient } from "@/lib/proposals/schemas";

/*
 * The proposal service (spec 14). SERVER ONLY: called by
 * `src/lib/data/proposals.ts` and by nothing else. This is the one place the
 * real client will live, with its API key and the proposal template ID.
 *
 * Today every function returns sample values and makes NO network call.
 */

/** The service's own vocabulary (spec 14, "What is known"). */
export type ServiceStatus = "draft" | "sent" | "won" | "lost" | "cancelled";
export type ServiceEvent = "proposal_viewed" | "proposal_signed";
export type ServiceReport = { status: ServiceStatus; events: ServiceEvent[] };

/**
 * MOCK CHOICE (spec 14, "Note": the mapping is not decided). The app's
 * statuses are draft, sent, viewed, signed, lost; the service's are draft,
 * sent, won, lost, cancelled, plus analytics events. Assumed here: a signature
 * is "won" or a `proposal_signed` event; "cancelled" counts as lost; "viewed"
 * is a sent proposal with a `proposal_viewed` event.
 */
export function toAppStatus(report: ServiceReport) {
  if (report.status === "won" || report.events.includes("proposal_signed")) {
    return "signed" as const;
  }
  if (report.status === "lost" || report.status === "cancelled") {
    return "lost" as const;
  }
  if (report.status === "draft") return "draft" as const;
  return report.events.includes("proposal_viewed")
    ? ("viewed" as const)
    : ("sent" as const);
}

/** Creates the proposal from the template, with the client as its recipient. */
export async function createProposal(input: {
  leadId: string;
  client: ProposalClient;
  lineItems: LineItem[];
}): Promise<{ serviceProposalId: string }> {
  return { serviceProposalId: `sample-proposal-${input.leadId}` };
}

/** Sends the proposal to the client by email and marks it Sent. */
export async function sendProposal(
  _serviceProposalId: string,
  _proposal: { client: ProposalClient; lineItems: LineItem[] },
): Promise<ServiceReport> {
  return { status: "sent", events: [] };
}

/**
 * Reads where the proposal stands and what has happened to it. There is no
 * service to ask, so the caller passes what the sample says happened and gets
 * it back; the real client ignores `sample` and asks the service.
 */
export async function readProposal(
  _serviceProposalId: string,
  sample: ServiceReport,
): Promise<ServiceReport> {
  return sample;
}
