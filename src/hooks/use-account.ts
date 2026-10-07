"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AccountPreferences } from "@/lib/account/schemas";
import { apiFetch } from "@/lib/api/client";
import { accountPreferencesOptions } from "@/lib/queries/account";
import { notificationKeys } from "@/lib/queries/notifications";

/*
 * Every client call for account preferences lives here (ADR-0001). The
 * person's name is the User resource: `useUpdateProfile` in use-auth.ts.
 */

export function useAccountPreferences() {
  return useQuery(accountPreferencesOptions);
}

export function useUpdateAccountPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AccountPreferences) =>
      apiFetch<AccountPreferences>("/api/account/preferences", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: (preferences) => {
      queryClient.setQueryData(accountPreferencesOptions.queryKey, preferences);
      // A type switched off leaves the list and the unread count.
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
