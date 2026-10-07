import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  LeadDetail,
  LeadFilters,
  LeadPage,
  PipelineSummary,
} from "@/lib/leads/schemas";

/*
 * One factory per resource for the key and the options (ADR-0001). Server
 * Components prefetch with these, overriding `queryFn` to call the data-access
 * function; the hooks in src/hooks/use-leads.ts read the same keys.
 */

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
};

export const leadKeys = {
  /** Every list, whatever its filters: what a write invalidates. */
  lists: ["leads", "list"],
  summaries: ["pipeline-summary"],
} as const;

/** A paged list of leads. The page size is the API's default. */
export const leadListOptions = (filters: LeadFilters) =>
  infiniteQueryOptions({
    queryKey: [...leadKeys.lists, filters],
    queryFn: ({ pageParam }) =>
      apiFetch<LeadPage>(
        `/api/leads?${query({ ...filters, cursor: pageParam })}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const leadOptions = (leadId: string) =>
  queryOptions({
    queryKey: ["leads", "detail", leadId],
    queryFn: () =>
      apiFetch<LeadDetail>(`/api/leads/${encodeURIComponent(leadId)}`),
  });

/** Counts depend on the viewer's day, so the time zone is part of the key. */
export const pipelineSummaryOptions = (tz: string) =>
  queryOptions({
    queryKey: [...leadKeys.summaries, tz],
    queryFn: () =>
      apiFetch<PipelineSummary>(`/api/pipeline/summary?${query({ tz })}`),
  });
