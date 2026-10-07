"use client";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { useResendConfirmation } from "@/hooks/use-auth";
import { useCountdown } from "@/hooks/use-countdown";
import { authErrorMessage } from "@/lib/auth/errors";

/** Supabase sends at most one confirmation email per address per 60 seconds. */
const RESEND_WAIT_SECONDS = 60;

/**
 * "Resend email" for an unconfirmed address, used by the "Check your email"
 * state and by sign-in's "not confirmed" state. After each send it is
 * unavailable for 60 seconds and shows the time remaining.
 */
export function ResendConfirmation({
  email,
  waitFirst = false,
}: {
  email: string;
  /** True when an email has just been sent (straight after sign-up). */
  waitFirst?: boolean;
}) {
  const resend = useResendConfirmation();
  const [remaining, startWait] = useCountdown(
    waitFirst ? RESEND_WAIT_SECONDS : 0,
  );

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        className="w-full tabular-nums"
        loading={resend.isPending}
        disabled={remaining > 0}
        // Keeps keyboard focus on the control while it counts down.
        focusableWhenDisabled
        onClick={() => {
          if (resend.isPending) return;
          resend.mutate(email, {
            onSuccess: () => startWait(RESEND_WAIT_SECONDS),
          });
        }}
      >
        {remaining > 0 ? `Resend email in ${remaining}s` : "Resend email"}
      </Button>
      <output className="text-center text-muted-foreground empty:hidden">
        {resend.isSuccess && remaining > 0 ? "Sent. Check your inbox." : null}
      </output>
      {resend.isError && (
        <FieldError className="text-center">
          {authErrorMessage(resend.error)}
        </FieldError>
      )}
    </div>
  );
}
