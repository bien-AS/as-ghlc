import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getPipelineSummary, listLeads } from "@/lib/data/leads";
import { listStatusDefs } from "@/lib/data/status-defs";
import { enforceRoute } from "@/lib/data/users";
import { listLeadsQuerySchema, parseLeadFilters } from "@/lib/leads/schemas";
import {
  leadListOptions,
  pipelineSummaryOptions,
  statusDefsOptions,
} from "@/lib/queries/leads";
import { getQueryClient } from "@/lib/query-client";
import { getViewerTimeZone } from "@/lib/viewer-time-zone";

import { PipelineScreen } from "../_components/pipeline-screen";
import { LEADS_HREF } from "../navigation";

export const metadata: Metadata = { title: "Leads · Authority Solutions" };

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  await enforceRoute(LEADS_HREF);

  const timeZone = await getViewerTimeZone();
  // The address is the single source of filter state (spec 05).
  const filters = parseLeadFilters(await searchParams, timeZone);

  // ADR-0001: prefetch through the data-access functions, never over HTTP.
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchInfiniteQuery({
      ...leadListOptions(filters),
      queryFn: ({ pageParam }) =>
        listLeads(
          listLeadsQuerySchema.parse({ ...filters, cursor: pageParam }),
        ),
    }),
    queryClient.prefetchQuery({
      ...pipelineSummaryOptions(timeZone),
      queryFn: () => getPipelineSummary({ tz: timeZone }),
    }),
    queryClient.prefetchQuery({
      ...statusDefsOptions(),
      queryFn: listStatusDefs,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PipelineScreen />
    </HydrationBoundary>
  );
}
