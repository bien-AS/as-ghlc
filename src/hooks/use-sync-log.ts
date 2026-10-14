"use client";

import { useQuery } from "@tanstack/react-query";

import { syncLogOptions } from "@/lib/queries/sync-log";

/** The writes the app has made to the CRM, newest first (ADR-0001). */
export function useSyncLog(enabled = true) {
  // A new write may have landed while the person was on another screen.
  return useQuery({
    ...syncLogOptions,
    enabled,
    refetchOnWindowFocus: "always",
  });
}
