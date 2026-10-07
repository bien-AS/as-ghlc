import { queryOptions } from "@tanstack/react-query";

import type { AccountPreferences } from "@/lib/account/schemas";
import { apiFetch } from "@/lib/api/client";

/** The current user's preferences. One factory for the key and options (ADR-0001). */
export const accountPreferencesOptions = queryOptions({
  queryKey: ["account", "preferences"],
  queryFn: () => apiFetch<AccountPreferences>("/api/account/preferences"),
});
