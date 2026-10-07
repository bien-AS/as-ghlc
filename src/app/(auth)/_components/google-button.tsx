"use client";

import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { useSignInWithGoogle } from "@/hooks/use-auth";
import { authErrorMessage } from "@/lib/auth/errors";

/** "Continue with Google"; behaves the same on sign-in and sign-up. */
export function GoogleButton({
  next,
  disabled,
}: {
  /** Where to land afterwards; already limited to a path inside the app. */
  next: string;
  disabled?: boolean;
}) {
  const google = useSignInWithGoogle();

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        className="w-full"
        // Stays in progress after success: the browser is leaving for Google.
        loading={google.isPending || google.isSuccess}
        disabled={disabled}
        onClick={() => {
          if (!google.isPending) google.mutate(next);
        }}
      >
        {!(google.isPending || google.isSuccess) && (
          <FcGoogle aria-hidden="true" data-icon="inline-start" />
        )}
        Continue with Google
      </Button>
      {google.isError && (
        <FieldError className="text-center">
          {authErrorMessage(google.error)}
        </FieldError>
      )}
    </div>
  );
}
