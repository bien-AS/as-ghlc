import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getPipelineSummary, listLeads } from "@/lib/data/leads";
import { enforceRoute } from "@/lib/data/users";
import { LEADS_PAGE_SIZE, parseLeadFilters } from "@/lib/leads/schemas";
import { leadListOptions, pipelineSummaryOptions } from "@/lib/queries/leads";
import { getQueryClient } from "@/lib/query-client";
import { getViewerTimeZone } from "@/lib/viewer-time-zone";

import { PipelineScreen } from "./_components/pipeline-screen";

export const metadata: Metadata = { title: "Pipeline · Dealwright" };

export default async function PipelinePage({
  searchParams,
}: PageProps<"/dashboard">) {
  await enforceRoute("/dashboard");

  const timeZone = await getViewerTimeZone();
  // The address is the single source of filter state (spec 05).
  const filters = parseLeadFilters(await searchParams, timeZone);

  // ADR-0001: prefetch through the data-access functions, never over HTTP.
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchInfiniteQuery({
      ...leadListOptions(filters),
      queryFn: ({ pageParam }) =>
        listLeads({ ...filters, cursor: pageParam, limit: LEADS_PAGE_SIZE }),
    }),
    queryClient.prefetchQuery({
      ...pipelineSummaryOptions(timeZone),
      queryFn: () => getPipelineSummary({ tz: timeZone }),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PipelineScreen />
    </HydrationBoundary>
  );
}
