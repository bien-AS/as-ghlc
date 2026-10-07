import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { listConnections } from "@/lib/data/connections";
import { AccessError, enforceRoute } from "@/lib/data/users";
import { connectionsOptions } from "@/lib/queries/connections";
import { getQueryClient } from "@/lib/query-client";

import { IntegrationsScreen } from "../_components/integrations-screen";
import { INTEGRATIONS_HREF } from "../navigation";

export const metadata: Metadata = { title: "Integrations · Dealwright" };

export default async function IntegrationsPage() {
  await enforceRoute(INTEGRATIONS_HREF);

  // ADR-0001: prefetch through the data-access function, never over HTTP.
  const queryClient = getQueryClient();
  let notAllowed = false;
  try {
    await queryClient.fetchQuery({
      ...connectionsOptions,
      queryFn: listConnections,
    });
  } catch (error) {
    // A role that may not manage Connections gets a screen of its own. Any
    // other failure is left for the client hook, which shows the error state.
    if (error instanceof AccessError && error.code === "forbidden") {
      notAllowed = true;
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <IntegrationsScreen notAllowed={notAllowed} />
    </HydrationBoundary>
  );
}
