"use client";

import {
  infiniteQueryOptions,
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  ListSyncLogQuery,
  SyncLogEntry,
  SyncLogPage,
} from "@/lib/sync-log/schemas";

/*
 * Every client call for the sync log screen (spec 06; ADR-0001). Admin only:
 * the Route Handlers refuse anyone else.
 */

type Filters = Omit<ListSyncLogQuery, "cursor">;

export const syncLogKeys = { lists: ["sync-log", "list"] } as const;

export const syncLogOptions = (filters: Filters) =>
  infiniteQueryOptions({
    queryKey: [...syncLogKeys.lists, filters],
    queryFn: ({ pageParam }) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries({
        ...filters,
        cursor: pageParam,
      })) {
        if (value) search.set(key, value);
      }
      return apiFetch<SyncLogPage>(`/api/admin/sync-log?${search}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** A paged list. Changing a filter keeps the current rows until the new ones arrive. */
export function useSyncLog(filters: Filters) {
  return useInfiniteQuery({
    ...syncLogOptions(filters),
    placeholderData: keepPreviousData,
  });
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
