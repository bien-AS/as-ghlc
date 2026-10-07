import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  NotificationPage,
  UnreadCount,
} from "@/lib/notifications/schemas";

/*
 * One factory per resource for the key and the options (ADR-0001). Server
 * Components prefetch with these, overriding `queryFn` to call the data-access
 * function; the hooks in src/hooks/use-notifications.ts read the same keys.
 */

export const notificationKeys = {
  /** The list and the count: what a change to notifications invalidates. */
  all: ["notifications"],
} as const;

/** The current user's notifications, a page at a time, newest first. */
export const notificationListOptions = infiniteQueryOptions({
  queryKey: [...notificationKeys.all, "list"],
  queryFn: ({ pageParam }) =>
    apiFetch<NotificationPage>(
      pageParam
        ? `/api/notifications?cursor=${encodeURIComponent(pageParam)}`
        : "/api/notifications",
    ),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});

export const unreadCountOptions = queryOptions({
  queryKey: [...notificationKeys.all, "unread-count"],
  queryFn: () => apiFetch<UnreadCount>("/api/notifications/unread-count"),
});
