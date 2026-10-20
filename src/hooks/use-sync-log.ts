"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import {
  type SyncLogFilters,
  syncLogKeys,
  syncLogOptions,
  webhookEventsOptions,
} from "@/lib/queries/sync-log";
import type { SyncLogEntry } from "@/lib/sync-log/schemas";

/*
 * Every client call for the sync log screen (spec 06; ADR-0001). Admin only:
 * the Route Handlers refuse anyone else.
 */

/** A paged list. Changing a filter keeps the current rows until the new ones arrive. */
export function useSyncLog(
  filters: SyncLogFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    ...syncLogOptions(filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** The webhooks tab: every event received, newest first, paged. */
export function useWebhookEvents() {
  return useInfiniteQuery(webhookEventsOptions);
}

/** "Retry" on a failed write; the lists are re-read whatever the outcome. */
export function useRetryWrite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SyncLogEntry>(
        `/api/admin/sync-log/${encodeURIComponent(id)}/retry`,
        { method: "POST", body: "{}" },
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: syncLogKeys.lists }),
  });
}
