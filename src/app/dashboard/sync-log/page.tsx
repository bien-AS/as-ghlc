import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { listSyncLog } from "@/lib/data/sync-log";
import { AccessError, enforceRoute } from "@/lib/data/users";
import { syncLogOptions } from "@/lib/queries/sync-log";
import { getQueryClient } from "@/lib/query-client";

import { SyncLogScreen } from "../_components/sync-log-screen";
import { SYNC_LOG_HREF } from "../navigation";

export const metadata: Metadata = {
  title: "Sync log · Authority Solutions",
};

export default async function SyncLogPage() {
  await enforceRoute(SYNC_LOG_HREF);

  const queryClient = getQueryClient();
  let notAllowed = false;
  try {
    await queryClient.fetchQuery({ ...syncLogOptions, queryFn: listSyncLog });
  } catch (error) {
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
