import type { Metadata } from "next";

import { AuthPanel, AuthShell } from "@/components/ui/auth-shell";
import { LinkButton } from "@/components/ui/link-button";

import { DASHBOARD_HREF } from "./(app)/navigation";

export const metadata: Metadata = {
  title: "Page not found · Authority Solutions",
};

/**
 * 404 (error-state-library): any unmatched address, and any `notFound()`.
 * Rendered in the root layout, outside the shell, so it takes the sign-in
 * screens' frame. A signed-out visitor who follows the link is sent to sign in.
 */
export default function NotFound() {
  return (
    <AuthShell>
      <AuthPanel
        title="Page not found"
        description="The address may be mistyped, or the page may have moved."
      >
        <LinkButton href={DASHBOARD_HREF} variant="primary">
          Go to the dashboard
        </LinkButton>
      </AuthPanel>
    </AuthShell>
  );
}
