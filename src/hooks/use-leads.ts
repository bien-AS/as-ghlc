"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import { useTimeZone } from "@/hooks/use-time-zone";
import { apiFetch } from "@/lib/api/client";
import type {
  LeadDetail,
  LeadFilters,
  LostInput,
  QualificationInput,
  ReviewInput,
} from "@/lib/leads/schemas";
import {
  leadKeys,
  leadListOptions,
  leadOptions,
  pipelineSummaryOptions,
} from "@/lib/queries/leads";

/*
 * Every client call for leads lives here (ADR-0001). Reads and writes go
 * through the Route Handlers under /api; nothing here knows the data is
 * sample data (ADR-0006).
 */

/** A paged list. Changing a filter keeps the current rows until the new ones arrive. */
export function useLeads(filters: LeadFilters) {
  return useInfiniteQuery({
    ...leadListOptions(filters),
    placeholderData: keepPreviousData,
  });
}

export function usePipelineSummary() {
  return useQuery({
    ...pipelineSummaryOptions(useTimeZone()),
    // The counts stay on screen while they are re-read for another time zone.
    placeholderData: keepPreviousData,
  });
}

export function useLead(leadId: string | undefined) {
  return useQuery({
    ...leadOptions(leadId ?? ""),
    enabled: Boolean(leadId),
    // A lead that does not exist will not start existing on a second try.
    retry: false,
  });
}

/**
 * The name of a lead the current page has already loaded, for the navbar's
 * breadcrumb. Reads the cache only; it never makes a request of its own.
 */
export function useLoadedLeadName(leadId: string | undefined) {
  return useQuery({ ...leadOptions(leadId ?? ""), enabled: false }).data?.name;
}

/** Warms the next suspect while the rep reads the current one (spec 07). */
export function usePrefetchLead(leadId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (leadId) void queryClient.prefetchQuery(leadOptions(leadId));
  }, [queryClient, leadId]);
}

function useLeadWrite<TInput>(segment: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: TInput }) =>
      apiFetch<LeadDetail>(
        `/api/leads/${encodeURIComponent(leadId)}/${segment}`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    // Every write returns the updated lead, which replaces the cached detail.
    onSuccess: (lead) => {
      queryClient.setQueryData(leadOptions(lead.id).queryKey, lead);
    },
    onSettled: (_lead, error, { leadId }) => {
      // Refused or failed: the lead may have changed elsewhere, so reload it.
      if (error) {
        void queryClient.invalidateQueries({
          queryKey: leadOptions(leadId).queryKey,
        });
      }
      void queryClient.invalidateQueries({ queryKey: leadKeys.lists });
      void queryClient.invalidateQueries({ queryKey: leadKeys.summaries });
    },
  });
}

export const useReviewSuspect = () => useLeadWrite<ReviewInput>("review");
export const useSetQualification = () =>
  useLeadWrite<QualificationInput>("qualification");
export const useMarkLost = () => useLeadWrite<LostInput>("lost");
export const useMarkSpam = () => useLeadWrite<Record<string, never>>("spam");
