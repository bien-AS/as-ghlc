"use client";

import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { useSignInWithGoogle } from "@/hooks/use-auth";
import { authErrorMessage } from "@/lib/auth/errors";

/** "Continue with Google", the only way to sign in. */
export function GoogleButton({
  next,
}: {
  /** The remembered page, already limited to an app screen; null for none. */
  next: string | null;
}) {
  const google = useSignInWithGoogle();
  // Stays in progress after success: the browser is leaving for Google.
  const leaving = google.isPending || google.isSuccess;

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        className="w-full"
        loading={leaving}
        onClick={() => {
          if (!leaving) google.mutate(next);
        }}
      >
        {!leaving && <FcGoogle aria-hidden="true" data-icon="inline-start" />}
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
