"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api/client";
import type { Notification } from "@/lib/notifications/schemas";
import {
  notificationKeys,
  notificationListOptions,
  unreadCountOptions,
} from "@/lib/queries/notifications";

/*
 * Every client call for notifications lives here (ADR-0001).
 *
 * NO REALTIME CHANNEL IS BUILT. The decided transport (spec 08: a Supabase
 * Realtime Broadcast "refetch now" signal on one private channel per user)
 * stays as the spec words it and is not implemented in this mockup; nothing
 * here imports the Supabase client. Its fallback is what is built: both
 * queries are read again whenever the person returns to the window. When the
 * channel is added, its handler invalidates `notificationKeys.all`.
 */

/** Returning to the window always re-reads, however fresh the cache is. */
const CATCH_UP = { refetchOnWindowFocus: "always" } as const;

/** The list, a page at a time, newest first. */
export function useNotifications() {
  return useInfiniteQuery({ ...notificationListOptions, ...CATCH_UP });
}

/** How many are unread, for the shell. Undefined while it is unknown. */
export function useUnreadCount() {
  return useQuery({ ...unreadCountOptions, ...CATCH_UP }).data?.count;
}

/**
 * Marks one notification read. The one optimistic update (spec 08): the row
 * and the count change at once; if the request fails they return to unread
 * with a brief message.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const listKey = notificationListOptions.queryKey;
  const countKey = unreadCountOptions.queryKey;

  /** Changes one row and the count in the cache, never anything else. */
  const setRead = (notificationId: string, read: boolean) => {
    queryClient.setQueryData(listKey, (current) =>
      current
        ? {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === notificationId ? { ...item, read } : item,
              ),
            })),
          }
        : current,
    );
    queryClient.setQueryData(countKey, (current) =>
      current
        ? { count: Math.max(0, current.count + (read ? -1 : 1)) }
        : current,
    );
  };

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiFetch<Notification>(
        `/api/notifications/${encodeURIComponent(notificationId)}/read`,
        { method: "POST" },
      ),
    onMutate: async (notificationId) => {
      // A read already in flight must not land on top of the optimistic state.
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const wasUnread = queryClient
        .getQueryData(listKey)
        ?.pages.some((page) =>
          page.items.some((item) => item.id === notificationId && !item.read),
        );
      if (wasUnread) setRead(notificationId, true);
      return { changed: Boolean(wasUnread) };
    },
    onError: (_error, notificationId, context) => {
      if (!context?.changed) return;
      // Only this row goes back: another row marked meanwhile keeps its state.
      setRead(notificationId, false);
      toast.add({
        title: "That could not be marked read. Try again.",
        type: "error",
      });
    },
    onSettled: () => {
      // The server is the truth, whether the write landed or not.
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
