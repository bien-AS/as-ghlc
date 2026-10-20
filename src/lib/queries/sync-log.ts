import { infiniteQueryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  ListSyncLogQuery,
  SyncLogPage,
  WebhookEventPage,
} from "@/lib/sync-log/schemas";

/*
 * The sync log's keys and options, one factory each (ADR-0001). Not a client
 * module, so the page can prefetch with the same key the hook reads.
 */

export type SyncLogFilters = Omit<ListSyncLogQuery, "cursor">;

export const syncLogKeys = {
  lists: ["sync-log", "list"],
  webhooks: ["sync-log", "webhooks"],
} as const;

const withQuery = (path: string, query: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) search.set(key, value);
  }
  return search.size ? `${path}?${search}` : path;
};

export const syncLogOptions = (filters: SyncLogFilters) =>
  infiniteQueryOptions({
    queryKey: [...syncLogKeys.lists, filters],
    queryFn: ({ pageParam }) =>
      apiFetch<SyncLogPage>(
        withQuery("/api/admin/sync-log", { ...filters, cursor: pageParam }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const webhookEventsOptions = infiniteQueryOptions({
  queryKey: syncLogKeys.webhooks,
  queryFn: ({ pageParam }) =>
    apiFetch<WebhookEventPage>(
      withQuery("/api/admin/sync-log/webhooks", { cursor: pageParam }),
    ),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});
