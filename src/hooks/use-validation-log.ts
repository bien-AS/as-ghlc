"use client";

import { useQuery } from "@tanstack/react-query";

import { validationLogOptions } from "@/lib/queries/validation-log";

/** Every verdict on a lead, newest first (ADR-0001). */
export function useValidationLog(enabled = true) {
  return useQuery({
    ...validationLogOptions,
    enabled,
    // A review on another screen changes an entry's override.
    refetchOnWindowFocus: "always",
  });
}
