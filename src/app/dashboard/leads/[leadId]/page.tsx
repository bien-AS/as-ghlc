import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getLead } from "@/lib/data/leads";
import { AccessError, enforceRoute } from "@/lib/data/users";
import { leadOptions } from "@/lib/queries/leads";
import { getQueryClient } from "@/lib/query-client";

import { LeadScreen } from "../../_components/lead-screen";
import { leadHref } from "../../navigation";

export const metadata: Metadata = { title: "Lead · Dealwright" };

export default async function LeadPage({
  params,
}: PageProps<"/dashboard/leads/[leadId]">) {
  const { leadId } = await params;
  await enforceRoute(leadHref(leadId));

  // ADR-0001: prefetch through the data-access function, never over HTTP.
  const queryClient = getQueryClient();
  let found = true;
  try {
    await queryClient.fetchQuery({
      ...leadOptions(leadId),
      queryFn: () => getLead(leadId),
    });
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
