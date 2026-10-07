import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getLead, listLeads } from "@/lib/data/leads";
import { enforceRoute } from "@/lib/data/users";
import { LEADS_PAGE_SIZE, parseLeadFilters } from "@/lib/leads/schemas";
import { leadListOptions, leadOptions } from "@/lib/queries/leads";
import { getQueryClient } from "@/lib/query-client";
import { getViewerTimeZone } from "@/lib/viewer-time-zone";

import { SuspectScreen } from "../../_components/suspect-screen";
import { SUSPECTS_HREF, suspectHref } from "../../navigation";

export const metadata: Metadata = { title: "Suspect review · Dealwright" };

/** /dashboard/suspects, and /dashboard/suspects/{leadId} for one suspect (spec 07). */
export default async function SuspectsPage({
  params,
}: PageProps<"/dashboard/suspects/[[...leadId]]">) {
  const segments = (await params).leadId ?? [];
  if (segments.length > 1) notFound();
  const leadId = segments[0];
  await enforceRoute(leadId ? suspectHref(leadId) : SUSPECTS_HREF);

  // ADR-0001: the queue and the selected suspect are prefetched through the
  // data-access functions, never over HTTP.
  const queryClient = getQueryClient();
  const filters = parseLeadFilters(
    { needs: "suspects" },
    await getViewerTimeZone(),
  );
  const queue = await queryClient
    .fetchInfiniteQuery({
      ...leadListOptions(filters),
      queryFn: ({ pageParam }) =>
        listLeads({ ...filters, cursor: pageParam, limit: LEADS_PAGE_SIZE }),
    })
    // A failure here is shown by the client hook, with a retry.
    .catch(() => undefined);

  const selected = leadId ?? queue?.pages[0]?.items[0]?.id;
  if (selected) {
    await queryClient.prefetchQuery({
      ...leadOptions(selected),
      queryFn: () => getLead(selected),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SuspectScreen leadId={leadId} />
    </HydrationBoundary>
  );
}
