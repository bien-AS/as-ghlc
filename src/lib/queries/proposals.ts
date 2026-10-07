import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { ProposalLead, ProposalView } from "@/lib/proposals/schemas";

/*
 * One factory per resource for the key and the options (ADR-0001). The
 * proposal builder's page prefetches with these, overriding `queryFn` to call
 * the data-access function; the hooks in src/hooks/use-proposals.ts read the
 * same keys.
 */

/** The picker's leads. */
export const proposalLeadsOptions = queryOptions({
  queryKey: ["proposals", "leads"],
  queryFn: () => apiFetch<ProposalLead[]>("/api/proposals"),
});

export const proposalPath = (leadId: string) =>
  `/api/proposals/${encodeURIComponent(leadId)}`;

/** One lead's proposal, with what the builder needs around it. */
export const proposalOptions = (leadId: string) =>
  queryOptions({
    queryKey: ["proposals", "detail", leadId],
    queryFn: () => apiFetch<ProposalView>(proposalPath(leadId)),
  });
