import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { ViewerSummary } from "@/lib/roles";

/** The viewer's role. One factory for the key and options (ADR-0001). */
export const viewerOptions = queryOptions({
  queryKey: ["viewer"],
  queryFn: () => apiFetch<ViewerSummary>("/api/viewer"),
});
