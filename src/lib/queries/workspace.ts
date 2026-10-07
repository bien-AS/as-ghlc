import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { Workspace } from "@/lib/workspace/schemas";

/** The viewer's Workspace. One factory for the key and options (ADR-0001). */
export const workspaceOptions = queryOptions({
  queryKey: ["workspace"],
  queryFn: () => apiFetch<Workspace>("/api/workspace"),
});
