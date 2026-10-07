"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthDivider, AuthPanel } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { useSignInWithPassword } from "@/hooks/use-auth";
import { useHydrated } from "@/hooks/use-hydrated";
import { authErrorCode, authErrorMessage } from "@/lib/auth/errors";
import { NOTICE } from "@/lib/auth/routing";
import { signInSchema } from "@/lib/auth/schemas";
import { clearErrorOnEdit, type FieldErrors, readForm } from "@/lib/forms";
import { navigate } from "@/lib/navigate";

import { GoogleButton } from "../_components/google-button";
import { ResendConfirmation } from "../_components/resend-confirmation";

/** Notices a redirect can carry to this page, by code. */
const NOTICES: Record<string, string> = {
  [NOTICE.linkInvalid]:
    "That link is no longer valid. It may have expired or already been used. If you have confirmed your email, sign in. If not, sign in and we will offer to send a new link.",
  [NOTICE.googleFailed]: "Google sign-in did not complete. Try again.",
  [NOTICE.signedOut]: "You have been signed out.",
};

export function SignInForm({
  next,
  notice,
}: {
  /** Where to land afterwards; already limited to a path inside the app. */
  next: string;
  notice?: string;
}) {
  const signIn = useSignInWithPassword();
  const [errors, setErrors] = useState<FieldErrors>({});
  // The submit control is inert until `onSubmit` is attached.
  const hydrated = useHydrated();
  const [attempted, setAttempted] = useState("");

  // Stays "pending" after success: the page is about to be replaced.
  const pending = signIn.isPending || signIn.isSuccess;
  const notConfirmed =
    signIn.isError && authErrorCode(signIn.error) === "email_not_confirmed";
  const noticeText = notice ? NOTICES[notice] : undefined;

  return (
    <AuthPanel
      title="Sign in"
      description="Welcome back to Dealwright."
      footer={
        <>
          New to Dealwright? <Link href="/sign-up">Create an account</Link>
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
          const form = event.currentTarget;
          const { data, errors: found } = readForm(signInSchema, form);
          setErrors(found ?? {});
          if (!data) return;

          setAttempted(data.email);
          signIn.mutate(data, {
            onSuccess: () => navigate(next),
            // The email is kept; the password is cleared and takes focus.
            onError: () => {
              const password = form.elements.namedItem("password");
              if (password instanceof HTMLInputElement) {
                password.value = "";
                password.focus();
              }
            },
          });
        }}
      >
        {noticeText && !signIn.isError && (
          <Alert role="status">
            <AlertDescription>{noticeText}</AlertDescription>
          </Alert>
        )}
        {signIn.isError &&
          (notConfirmed ? (
            <Alert>
              <AlertDescription className="flex flex-col gap-3">
                <p className="text-foreground">
                  {authErrorMessage(signIn.error)} We sent a link to{" "}
                  <strong className="font-semibold break-all">
                    {attempted}
                  </strong>
                  .
                </p>
                <ResendConfirmation email={attempted} />
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                {authErrorMessage(signIn.error)}
              </AlertDescription>
            </Alert>
          ))}
        <FieldGroup>
          <FormField
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            error={errors.email}
            readOnly={pending}
            required
          />
          <FormField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={errors.password}
            readOnly={pending}
            required
          />
          <Link
            href="/reset-password"
            className="-mt-2 self-start font-semibold text-brand-text underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </FieldGroup>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={pending}
          disabled={!hydrated}
        >
          Sign in
        </Button>
      </form>
      <AuthDivider />
      <GoogleButton next={next} disabled={pending} />
    </AuthPanel>
  );
}
