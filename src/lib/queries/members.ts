import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { Member } from "@/lib/members/schemas";

/**
 * Everyone with access to the Workspace. One factory for the key and options
 * (ADR-0001); the page prefetches with it, overriding `queryFn`.
 */
export const membersOptions = queryOptions({
  queryKey: ["members"],
  queryFn: () => apiFetch<Member[]>("/api/members"),
});
