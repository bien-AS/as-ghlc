import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { SyncLog } from "@/lib/sync/schemas";

/** One factory for the key and the options (ADR-0001). */
export const syncLogKeys = { all: ["sync-log"] } as const;

export const syncLogOptions = queryOptions({
  queryKey: syncLogKeys.all,
  queryFn: () => apiFetch<SyncLog>("/api/sync-log"),
});
