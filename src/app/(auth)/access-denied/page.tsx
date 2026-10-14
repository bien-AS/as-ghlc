import type { Metadata } from "next";

import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/state-panel";

export const metadata: Metadata = { title: "No access" };

/**
 * Where a Workspace member who has not been provisioned lands. Static for now:
 * the invite-only rule (build packet, S5) is not wired, so nothing sends anyone here yet.
 */
export default function AccessDeniedPage() {
  return (
    <EmptyState
      title="You do not have access yet"
      description="This account has not been invited. Ask an admin of the Workspace to add you, then sign in again."
      action={
        <LinkButton variant="primary" href="/sign-in">
          Back to sign in
        </LinkButton>
      }
    />
  );
}
