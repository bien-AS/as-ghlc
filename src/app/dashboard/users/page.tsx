import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { listMembers } from "@/lib/data/members";
import { AccessError, enforceRoute } from "@/lib/data/users";
import { membersOptions } from "@/lib/queries/members";
import { getQueryClient } from "@/lib/query-client";

import { UsersScreen } from "../_components/users-screen";
import { USERS_HREF } from "../navigation";

export const metadata: Metadata = { title: "Users and roles · Dealwright" };

export default async function UsersPage() {
  await enforceRoute(USERS_HREF);

  // ADR-0001: prefetch through the data-access function, never over HTTP.
  const queryClient = getQueryClient();
  let notAllowed = false;
  try {
    await queryClient.fetchQuery({
      ...membersOptions,
      queryFn: () => listMembers(),
    });
  } catch (error) {
    // A role that may not manage users gets a screen of its own, not an error.
    // Any other failure is left for the client hook, which offers a retry.
    if (error instanceof AccessError && error.code === "forbidden") {
      notAllowed = true;
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsersScreen notAllowed={notAllowed} />
    </HydrationBoundary>
  );
}
