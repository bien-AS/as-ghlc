"use client";

import { useEffect, useRef } from "react";

import { AuthPanel } from "@/components/ui/auth-shell";
import { Spinner } from "@/components/ui/spinner";
import { useCreateProfileSilently } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import { navigate } from "@/lib/navigate";

import { ProfileSetupForm } from "./profile-setup-form";

/**
 * The silent path, as the person sees it: "Setting up your account" while the
 * server creates the profile from the session, then the dashboard. If that
 * cannot be done, the ordinary form takes its place. There is always something
 * on screen: this state, the form, or the page the browser is loading next.
 */
export function SilentProfileSetup(
  props: React.ComponentProps<typeof ProfileSetupForm>,
) {
  const { mutate, isSuccess, isError, error } = useCreateProfileSilently();

  // Once per visit. The ref survives the extra effect run React makes in
  // development; a second request would be harmless, but is not needed.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    mutate();
  }, [mutate]);

  useEffect(() => {
    if (isSuccess) navigate("/dashboard");
  }, [isSuccess]);

  // A 401 is already on its way to sign-in; keep this state until it arrives.
  const signedOut = error instanceof ApiError && error.status === 401;
  if (isError && !signedOut) return <ProfileSetupForm {...props} />;

  return (
    <AuthPanel title="Setting up your account">
      <p className="flex items-center gap-2 text-muted-foreground">
        <Spinner />
        One moment.
      </p>
    </AuthPanel>
  );
}
