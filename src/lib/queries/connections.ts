import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { Connection } from "@/lib/connections/schemas";

/** The Workspace's Connections. One factory for the key and options (ADR-0001). */
export const connectionsOptions = queryOptions({
  queryKey: ["connections"],
  queryFn: () => apiFetch<Connection[]>("/api/connections"),
});
