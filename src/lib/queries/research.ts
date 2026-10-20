import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { LeadResearch } from "@/lib/research/schemas";

/*
 * Key and options for a lead's research brief (ADR-0001). The lead page can
 * prefetch with these, overriding `queryFn` to call `getLatestResearch`; the
 * hooks in src/hooks/use-research.ts read the same key.
 */

export const researchPath = (leadId: string) =>
  `/api/leads/${encodeURIComponent(leadId)}/research`;

export const researchOptions = (leadId: string) =>
  queryOptions({
    queryKey: ["leads", "research", leadId],
    queryFn: () => apiFetch<LeadResearch>(researchPath(leadId)),
  });
