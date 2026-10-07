import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getAccountPreferences } from "@/lib/data/account";
import { enforceRoute } from "@/lib/data/users";
import { accountPreferencesOptions } from "@/lib/queries/account";
import { meQueryOptions } from "@/lib/queries/me";
import { getQueryClient } from "@/lib/query-client";

import { AccountScreen } from "../_components/account-screen";
import { ACCOUNT_HREF } from "../navigation";

export const metadata: Metadata = { title: "Account settings · Dealwright" };

export default async function AccountPage() {
  const current = await enforceRoute(ACCOUNT_HREF);

  // ADR-0001: prefetch through the data-access functions, never over HTTP. A
  // failure is left for the client hooks, which show the error state.
  const queryClient = getQueryClient();
  if (current.status === "ready") {
    queryClient.setQueryData(meQueryOptions.queryKey, current.user);
  }
  await queryClient.prefetchQuery({
    ...accountPreferencesOptions,
    queryFn: getAccountPreferences,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AccountScreen />
    </HydrationBoundary>
  );
}
