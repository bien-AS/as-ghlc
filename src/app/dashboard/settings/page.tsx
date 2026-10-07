import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { AccessError, enforceRoute } from "@/lib/data/users";
import { getWorkspace } from "@/lib/data/workspace";
import { workspaceOptions } from "@/lib/queries/workspace";
import { getQueryClient } from "@/lib/query-client";

import { WorkspaceScreen } from "../_components/workspace-screen";
import { WORKSPACE_SETTINGS_HREF } from "../navigation";

export const metadata: Metadata = { title: "Workspace settings · Dealwright" };

export default async function WorkspaceSettingsPage() {
  await enforceRoute(WORKSPACE_SETTINGS_HREF);

  // ADR-0001: prefetch through the data-access function, never over HTTP.
  const queryClient = getQueryClient();
  let notAllowed = false;
  try {
    await queryClient.fetchQuery({
      ...workspaceOptions,
      queryFn: getWorkspace,
    });
  } catch (error) {
    // A role that may not manage the Workspace gets a screen of its own. Any
    // other failure is left for the client hook, which shows the error state.
    if (error instanceof AccessError && error.code === "forbidden") {
      notAllowed = true;
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WorkspaceScreen notAllowed={notAllowed} />
    </HydrationBoundary>
  );
}
