"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { navigate } from "@/lib/navigate";
import { viewerOptions } from "@/lib/queries/viewer";
import {
  type Capability,
  can,
  type Role,
  type ViewerSummary,
} from "@/lib/roles";

/*
 * The viewer's role, for screens that hide what a role cannot use (spec 12).
 * Hiding is never the control: the data-access layer refuses independently.
 */

export function useViewer() {
  return useQuery(viewerOptions);
}

/** Whether the viewer may use something. False until the role is known. */
export function useCan(capability: Capability) {
  const role = useViewer().data?.role;
  return role ? can(role, capability) : false;
}

/**
 * Preview only: switches the role the sample dashboard is shown as, then loads
 * the page again so the server decides everything the new role sees.
 */
export function useSetPreviewRole() {
  return useMutation({
    mutationFn: (role: Role) =>
      apiFetch<ViewerSummary>("/api/viewer/role", {
        method: "POST",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      navigate(`${window.location.pathname}${window.location.search}`);
    },
  });
}
