"use client";

import { useQuery } from "@tanstack/react-query";

import { viewerOptions } from "@/lib/queries/viewer";
import { type Capability, can } from "@/lib/roles";

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
