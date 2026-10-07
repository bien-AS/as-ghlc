"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { workspaceOptions } from "@/lib/queries/workspace";
import type { UpdateWorkspaceInput, Workspace } from "@/lib/workspace/schemas";

/*
 * Every client call for the Workspace lives here (ADR-0001). Nothing here
 * knows the data is sample data (ADR-0006).
 */

export function useWorkspace(enabled = true) {
  return useQuery({
    ...workspaceOptions,
    enabled,
    // A role that is refused will not be allowed on a second try.
    retry: false,
  });
}

/** Every write answers with the Workspace as it now is, which replaces the cached one. */
function useWorkspaceWrite<TInput>(
  request: (input: TInput) => [path: string, init: RequestInit],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => apiFetch<Workspace>(...request(input)),
    onSuccess: (workspace) => {
      queryClient.setQueryData(workspaceOptions.queryKey, workspace);
    },
    // Refused or failed: it may have changed elsewhere, so read it again.
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: workspaceOptions.queryKey,
      });
    },
  });
}

export const useUpdateWorkspace = () =>
  useWorkspaceWrite<UpdateWorkspaceInput>((input) => [
    "/api/workspace",
    { method: "PUT", body: JSON.stringify(input) },
  ]);

export const useAddAllowedDomain = () =>
  useWorkspaceWrite<string>((domain) => [
    "/api/workspace/domains",
    { method: "POST", body: JSON.stringify({ domain }) },
  ]);

export const useRemoveAllowedDomain = () =>
  useWorkspaceWrite<string>((domain) => [
    `/api/workspace/domains/${encodeURIComponent(domain)}`,
    { method: "DELETE" },
  ]);
