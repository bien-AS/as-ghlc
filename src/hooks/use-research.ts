"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { researchOptions, researchPath } from "@/lib/queries/research";

/*
 * Every client call for a lead's research brief (ADR-0001), through
 * /api/leads/[leadId]/research.
 */

/** While a run is generating, poll until it is ready or failed. */
const POLL_MS = 5_000;

export function useResearch(leadId: string | undefined) {
  return useQuery({
    ...researchOptions(leadId ?? ""),
    enabled: Boolean(leadId),
    refetchInterval: (query) =>
      query.state.data?.run?.status === "generating" ? POLL_MS : false,
  });
}

/**
 * "Refresh research": queues a run and shows it as generating at once, which
 * starts the polling; the previous brief stays shown meanwhile.
 *
 * ponytail: if the job has not opened its row by the first poll (5 s), the poll
 * reads no run and stops; expose the run's request time if that shows up.
 */
export function useRefreshResearch(leadId: string) {
  const queryClient = useQueryClient();
  const { queryKey } = researchOptions(leadId);
  return useMutation({
    mutationFn: () =>
      apiFetch<{ eventId: string }>(researchPath(leadId), { method: "POST" }),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, (old) =>
        old
          ? {
              ...old,
              run: {
                status: "generating" as const,
                error: null,
                createdAt: new Date().toISOString(),
              },
            }
          : old,
      );
    },
  });
}
