"use client";

import { AuthPanel, AuthShell } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";

import { DASHBOARD_HREF } from "./(app)/navigation";

/**
 * 500 outside the shell (error-state-library): a sign-in screen, or the app
 * layout itself, failed. `retry` asks the server again and re-renders. Errors
 * in a screen inside the shell are caught by (app)/error.tsx instead.
 */
export default function RootError({ retry }: { retry: () => void }) {
  return (
    <AuthShell>
      <AuthPanel
        title="Something went wrong"
        description="This page could not be loaded. Nothing was changed."
      >
        <Button variant="primary" onClick={() => retry()}>
          Try again
        </Button>
        <LinkButton href={DASHBOARD_HREF}>Go to the dashboard</LinkButton>
      </AuthPanel>
    </AuthShell>
  );
}
