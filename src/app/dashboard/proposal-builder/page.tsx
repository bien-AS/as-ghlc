import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getProposal, listProposalLeads } from "@/lib/data/proposals";
import { AccessError, enforceRoute } from "@/lib/data/users";
import { parseProposalLead } from "@/lib/proposals/schemas";
import { proposalLeadsOptions, proposalOptions } from "@/lib/queries/proposals";
import { getQueryClient } from "@/lib/query-client";

import { ProposalBuilderScreen } from "../_components/proposal-builder-screen";
import { PROPOSAL_BUILDER_HREF, proposalHref } from "../navigation";

export const metadata: Metadata = { title: "Proposal builder · Dealwright" };

/** /dashboard/proposal-builder, and ?lead={id} for one lead's proposal (spec 14). */
export default async function ProposalBuilderPage({
  searchParams,
}: PageProps<"/dashboard/proposal-builder">) {
  // The address is the single source of which lead is open.
  const leadId = parseProposalLead(await searchParams);
  await enforceRoute(leadId ? proposalHref(leadId) : PROPOSAL_BUILDER_HREF);

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
  } else {
    await queryClient.prefetchQuery({
      ...proposalLeadsOptions,
      queryFn: () => listProposalLeads(),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProposalBuilderScreen missing={!found} />
    </HydrationBoundary>
  );
}
