import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { listSyncLog } from "@/lib/data/sync-log";
import { AccessError, enforceRoute } from "@/lib/data/users";
import { syncLogOptions } from "@/lib/queries/sync-log";
import { getQueryClient } from "@/lib/query-client";

import { SyncLogScreen } from "./sync-log-screen";

export const metadata: Metadata = {
  title: "Sync log · Authority Solutions",
};

export default async function SyncLogPage() {
  // The Admin group's "Logs" entry (navigation.ts).
  await enforceRoute("/admin/sync-log");

  // ADR-0001: prefetch through the data-access function, never over HTTP.
  const queryClient = getQueryClient();
  let notAllowed = false;
  try {
    await queryClient.fetchInfiniteQuery({
      ...syncLogOptions({}),
      queryFn: () => listSyncLog({}),
    });
  } catch (error) {
    // A rep gets a screen of its own. Any other failure is left for the
    // client hook, which shows the error state.
    if (error instanceof AccessError && error.code === "forbidden") {
      notAllowed = true;
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SyncLogScreen notAllowed={notAllowed} />
    </HydrationBoundary>
  );
}
