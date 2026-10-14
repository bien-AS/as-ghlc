import { AuthShell } from "@/components/ui/auth-shell";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/state-panel";

/** An unknown address outside the dashboard (the dashboard has its own, inside the shell). */
export default function NotFound() {
  return (
    <AuthShell>
      <EmptyState
        title="Page not found"
        description="There is no page at this address. It may have moved, or the link may be wrong."
        action={
          <LinkButton variant="primary" href="/dashboard">
            Go to the dashboard
          </LinkButton>
        }
      />
    </AuthShell>
  );
}
