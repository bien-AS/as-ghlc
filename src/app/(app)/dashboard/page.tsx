import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getDashboard } from "@/lib/data/dashboard";
import { enforceRoute } from "@/lib/data/users";
import { dashboardOptions } from "@/lib/queries/leads";
import { getQueryClient } from "@/lib/query-client";
import { getViewerTimeZone } from "@/lib/viewer-time-zone";

import { DASHBOARD_HREF } from "../navigation";
import { DashboardScreen } from "./dashboard-screen";

export const metadata: Metadata = { title: "Dashboard · Authority Solutions" };

/** The home screen, where sign-in lands (spec 07, registry `dashboard`). */
export default async function DashboardPage() {
  await enforceRoute(DASHBOARD_HREF);

  // ADR-0001: prefetch through the data-access function, never over HTTP. A
  // failure is left for the client hook, which shows the error state.
  const timeZone = await getViewerTimeZone();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    ...dashboardOptions(timeZone),
    queryFn: () => getDashboard({ tz: timeZone }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardScreen />
    </HydrationBoundary>
  );
}
