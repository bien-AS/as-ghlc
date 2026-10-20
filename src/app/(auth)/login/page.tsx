import type { Metadata } from "next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthPanel } from "@/components/ui/auth-shell";
import { NOTICE, rememberedPage } from "@/lib/auth/routing";
import { enforceRoute } from "@/lib/data/users";

import { GoogleButton } from "../_components/google-button";

export const metadata: Metadata = { title: "Sign in · Authority Solutions" };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** The one way in (spec 01 section 5, ADR-0008): Google, for provisioned staff. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await enforceRoute("/login");
  const { next, notice } = await searchParams;
  const failed = first(notice) === NOTICE.googleFailed;

  return (
    <AuthPanel
      title="Sign in"
      description="Use your Authority Solutions Google account."
      footer="Only accounts an admin has set up can sign in."
    >
      {failed && (
        <Alert role="status">
          <AlertDescription>
            Google sign-in did not complete. Try again.
          </AlertDescription>
        </Alert>
      )}
      <GoogleButton next={rememberedPage(first(next))} />
    </AuthPanel>
  );
}
