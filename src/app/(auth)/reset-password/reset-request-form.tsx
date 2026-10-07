"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthPanel } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useRequestPasswordReset } from "@/hooks/use-auth";
import { useHydrated } from "@/hooks/use-hydrated";
import { authErrorMessage } from "@/lib/auth/errors";
import { NOTICE } from "@/lib/auth/routing";
import { resetRequestSchema } from "@/lib/auth/schemas";
import { clearErrorOnEdit, type FieldErrors, readForm } from "@/lib/forms";

const NOTICES: Record<string, string> = {
  [NOTICE.linkInvalid]:
    "That link is no longer valid. It may have expired or already been used. Request a new one.",
};

export function ResetRequestForm({ notice }: { notice?: string }) {
  const request = useRequestPasswordReset();
  const [errors, setErrors] = useState<FieldErrors>({});
  // The submit control is inert until `onSubmit` is attached.
  const hydrated = useHydrated();
  const [sentTo, setSentTo] = useState("");

  const pending = request.isPending;
  const noticeText = notice ? NOTICES[notice] : undefined;

  return (
    <AuthPanel
      title="Reset your password"
      description="Enter your email and we will send a link to choose a new password."
      footer={
        <>
          Remembered it? <Link href="/sign-in">Sign in</Link>
        </>
      }
    >
      <form
        // Never GET: a submit the browser handles itself must not put fields in the address.
        method="post"
        noValidate
        aria-busy={pending}
        onChange={clearErrorOnEdit(setErrors)}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const { data, errors: found } = readForm(
            resetRequestSchema,
            event.currentTarget,
          );
          setErrors(found ?? {});
          if (!data) return;
          request.mutate(data, { onSuccess: () => setSentTo(data.email) });
        }}
      >
        {noticeText && request.isIdle && (
          <Alert role="status">
            <AlertDescription>{noticeText}</AlertDescription>
          </Alert>
        )}
        {/* The same words whatever the address: never reveals whether an account exists. */}
        {request.isSuccess && (
          <Alert role="status">
            <AlertDescription className="text-foreground">
              If an account exists for{" "}
              <strong className="font-semibold break-all">{sentTo}</strong>, we
              have sent a link to reset your password.
            </AlertDescription>
          </Alert>
        )}
        {request.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {authErrorMessage(request.error, "reset-request")}
            </AlertDescription>
          </Alert>
        )}
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.email}
          readOnly={pending}
          required
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={pending}
          disabled={!hydrated}
        >
          Send reset link
        </Button>
      </form>
    </AuthPanel>
  );
}
