import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { CurrentUser } from "@/lib/auth/schemas";

/**
 * The current User. One factory for the key and options (ADR-0001): the
 * dashboard's Server Component prefetches with it, overriding `queryFn` to
 * call the data-access function, and `useCurrentUser` reads the same key.
 */
export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: () => apiFetch<CurrentUser>("/api/me"),
});
