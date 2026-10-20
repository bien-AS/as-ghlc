import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getLead } from "@/lib/data/leads";
import { getLatestResearch } from "@/lib/data/research";
import { listStatusDefs } from "@/lib/data/status-defs";
import { AccessError, enforceRoute } from "@/lib/data/users";
import { leadOptions, statusDefsOptions } from "@/lib/queries/leads";
import { researchOptions } from "@/lib/queries/research";
import { getQueryClient } from "@/lib/query-client";

import { LeadScreen } from "../../_components/lead-screen";
import { leadHref } from "../../navigation";

export const metadata: Metadata = { title: "Lead · Authority Solutions" };

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const { id: leadId } = await params;
  await enforceRoute(leadHref(leadId));

  // ADR-0001: prefetch through the data-access functions, never over HTTP.
  const queryClient = getQueryClient();
  let found = true;
  try {
    await queryClient.fetchQuery({
      ...leadOptions(leadId),
      queryFn: () => getLead(leadId),
    });
    // The research tab is one click away, so its brief is on first paint too.
    // prefetchQuery never throws: a failure is left for the client hook.
    // So is the Change status picklist.
    await Promise.all([
      queryClient.prefetchQuery({
        ...researchOptions(leadId),
        queryFn: () => getLatestResearch(leadId),
      }),
      queryClient.prefetchQuery({
        ...statusDefsOptions(),
        queryFn: listStatusDefs,
      }),
    ]);
  } catch (error) {
    // An unknown lead is a screen of its own, not an error. Any other failure
    // is left for the client hook, which shows the error state with a retry.
    if (error instanceof AccessError && error.code === "not_found") {
      found = false;
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LeadScreen leadId={leadId} missing={!found} />
    </HydrationBoundary>
  );
}
