import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getPipelineSummary, SAMPLE_DATA } from "@/lib/data/leads";
import { getUnreadCount } from "@/lib/data/notifications";
import { enforceRoute } from "@/lib/data/users";
import { getViewerSummary } from "@/lib/data/viewer";
import { pipelineSummaryOptions } from "@/lib/queries/leads";
import { meQueryOptions } from "@/lib/queries/me";
import { unreadCountOptions } from "@/lib/queries/notifications";
import { viewerOptions } from "@/lib/queries/viewer";
import { getQueryClient } from "@/lib/query-client";
import { getViewerTimeZone } from "@/lib/viewer-time-zone";

import { DashboardShell } from "./_components/dashboard-shell";

/*
 * Everything under /dashboard is protected in three places:
 *  - src/proxy.ts sends signed-out visitors to /sign-in, remembering the page;
 *  - this layout applies the full table (including "no profile") when a
 *    dashboard page is first loaded, before any of the shell renders;
 *  - every data-access function starts with `requireUser`, which is the real
 *    line of defence: a layout does not re-run on client navigation, so each
 *    page also calls `enforceRoute` itself.
 */
export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const current = await enforceRoute("/dashboard");
  // enforceRoute has redirected every other state away.
  if (current.status !== "ready") redirect("/sign-in");

  const timeZone = await getViewerTimeZone();
  // Written by the sidebar when the person collapses or expands it.
  const remembered = (await cookies()).get("sidebar_state")?.value;

  // ADR-0001: what the shell shows on first paint (the user menu, the role,
  // the suspect count and the unread count) is prefetched through the data-access layer, never over HTTP.
  const queryClient = getQueryClient();
  queryClient.setQueryData(meQueryOptions.queryKey, current.user);
  await Promise.all([
    queryClient.prefetchQuery({
      ...pipelineSummaryOptions(timeZone),
      queryFn: () => getPipelineSummary({ tz: timeZone }),
    }),
    // The role decides which sidebar entries exist, so it is known on first paint.
    queryClient.prefetchQuery({
      ...viewerOptions,
      queryFn: getViewerSummary,
    }),
    // A failure leaves the shell with no count, not a zero (spec 08).
    queryClient.prefetchQuery({
      ...unreadCountOptions,
      queryFn: getUnreadCount,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardShell
        timeZone={timeZone}
        sampleData={SAMPLE_DATA}
        sidebarOpen={
          remembered === undefined ? undefined : remembered === "true"
        }
      >
        {children}
      </DashboardShell>
    </HydrationBoundary>
  );
}
