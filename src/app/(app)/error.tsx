"use client";

import { LinkButton } from "@/components/ui/link-button";
import { ErrorState } from "@/components/ui/state-panel";

import { DASHBOARD_HREF } from "./navigation";

/**
 * 500 inside the shell (error-state-library): the sidebar and navbar stay, and
 * the screen's area says what happened. `retry` asks the server again and
 * re-renders the screen.
 */
export default function AppError({ retry }: { retry: () => void }) {
  return (
    <ErrorState
      title="This page could not be loaded"
      description="Something went wrong on our side. Nothing was changed."
      onRetry={() => retry()}
      action={
        <LinkButton href={DASHBOARD_HREF}>Go to the dashboard</LinkButton>
      }
    />
  );
}
