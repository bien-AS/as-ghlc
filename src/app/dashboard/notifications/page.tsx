import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getUnreadCount, listNotifications } from "@/lib/data/notifications";
import { enforceRoute } from "@/lib/data/users";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/notifications/schemas";
import {
  notificationListOptions,
  unreadCountOptions,
} from "@/lib/queries/notifications";
import { getQueryClient } from "@/lib/query-client";

import { NotificationsScreen } from "../_components/notifications-screen";
import { NOTIFICATIONS_HREF } from "../navigation";

export const metadata: Metadata = { title: "Notifications · Dealwright" };

export default async function NotificationsPage() {
  await enforceRoute(NOTIFICATIONS_HREF);

  // ADR-0001: prefetch through the data-access functions, never over HTTP. A
  // failure is left for the client hooks, which show the error state.
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchInfiniteQuery({
      ...notificationListOptions,
      queryFn: ({ pageParam }) =>
        listNotifications({
          cursor: pageParam,
          limit: NOTIFICATIONS_PAGE_SIZE,
        }),
    }),
    // The layout does not run again on a move between screens, so the count
    // the shell shows is read here too.
    queryClient.prefetchQuery({
      ...unreadCountOptions,
      queryFn: getUnreadCount,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NotificationsScreen />
    </HydrationBoundary>
  );
}
