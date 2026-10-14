"use client";

import { LinkButton } from "@/components/ui/link-button";
import { ErrorState } from "@/components/ui/state-panel";

import { PIPELINE_HREF } from "./navigation";

/** An unexpected failure inside a dashboard screen, shown inside the shell (spec 04). */
export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="This screen could not load"
      description="Something went wrong on our side. Try again, or go back to the Pipeline."
      onRetry={reset}
      action={
        <LinkButton variant="outline" href={PIPELINE_HREF}>
          Go to the Pipeline
        </LinkButton>
      }
    />
  );
}
