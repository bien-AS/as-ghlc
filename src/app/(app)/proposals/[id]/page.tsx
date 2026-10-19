import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getProposal } from "@/lib/data/proposals";
import { AccessError, enforceRoute } from "@/lib/data/users";
import { parseProposalLead } from "@/lib/proposals/schemas";
import { proposalOptions } from "@/lib/queries/proposals";
import { getQueryClient } from "@/lib/query-client";

import { ProposalBuilderScreen } from "../../_components/proposal-builder-screen";
import { PROPOSALS_HREF, proposalHref } from "../../navigation";

export const metadata: Metadata = {
  title: "Proposal builder · Authority Solutions",
};

/** /proposals/{id}: one lead's proposal (spec 14; a mockup keyed by the lead). */
export default async function ProposalPage({
  params,
}: PageProps<"/proposals/[id]">) {
  // The address is the single source of which lead is open.
  const leadId = parseProposalLead({ lead: (await params).id });
  await enforceRoute(leadId ? proposalHref(leadId) : PROPOSALS_HREF);

  // ADR-0001: prefetch through the data-access functions, never over HTTP.
  const queryClient = getQueryClient();
  let found = true;
  if (leadId) {
    try {
      await queryClient.fetchQuery({
        ...proposalOptions(leadId),
        queryFn: () => getProposal(leadId),
      });
    } catch (error) {
      // An unknown lead (or another rep's) is a screen of its own, not an
      // error. Any other failure is left for the client hook, with a retry.
      if (error instanceof AccessError && error.code === "not_found") {
        found = false;
      }
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProposalBuilderScreen leadId={leadId} missing={!found} />
    </HydrationBoundary>
  );
}
