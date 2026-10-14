"use client";

import { AuthShell } from "@/components/ui/auth-shell";
import { LinkButton } from "@/components/ui/link-button";
import { ErrorState } from "@/components/ui/state-panel";

/** An unexpected failure outside the dashboard. Says what happened, never the error text. */
export default function RootError({ reset }: { reset: () => void }) {
  return (
    <AuthShell>
      <ErrorState
        title="Something went wrong"
        description="We could not load this page. Try again, or go back to the dashboard."
        onRetry={reset}
        action={
          <LinkButton variant="outline" href="/dashboard">
            Go to the dashboard
          </LinkButton>
        }
      />
    </AuthShell>
  );
}
