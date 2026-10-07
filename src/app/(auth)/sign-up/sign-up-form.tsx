"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthDivider, AuthPanel } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { useSignUp } from "@/hooks/use-auth";
import { useHydrated } from "@/hooks/use-hydrated";
import { authErrorMessage } from "@/lib/auth/errors";
import { PASSWORD_MIN_LENGTH, signUpSchema } from "@/lib/auth/schemas";
import { clearErrorOnEdit, type FieldErrors, readForm } from "@/lib/forms";

import { GoogleButton } from "../_components/google-button";
import { ResendConfirmation } from "../_components/resend-confirmation";

type Kept = { firstName: string; lastName: string; email: string };

export function SignUpForm({ next }: { next: string }) {
  const signUp = useSignUp();
  const [errors, setErrors] = useState<FieldErrors>({});
  // The submit control is inert until `onSubmit` is attached.
  const hydrated = useHydrated();
  // Kept across the swap to "Check your email" so a mistyped address can be
  // corrected without retyping the names. The password is never kept.
  const [kept, setKept] = useState<Kept>({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [sentTo, setSentTo] = useState<string | null>(null);

  const heading = useRef<HTMLHeadingElement>(null);
  const swapped = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on each swap between the two states
  useEffect(() => {
    // After a swap (not on first load) announce the new state by focusing its heading.
    if (swapped.current) heading.current?.focus();
  }, [sentTo]);

  if (sentTo) {
    return (
      <AuthPanel
        key="check-email"
        headingRef={heading}
        title="Check your email"
        description={
          <>
            We sent a confirmation link to{" "}
            <strong className="font-semibold break-all text-foreground">
              {sentTo}
            </strong>
            . Open it to finish creating your account.
          </>
        }
      >
        <ResendConfirmation email={sentTo} waitFirst />
        <Button
          variant="link"
          className="self-center"
          onClick={() => {
            signUp.reset();
            setSentTo(null);
          }}
        >
          Use a different email
        </Button>
        <p className="border-t border-border pt-4 text-pretty text-muted-foreground [&_a]:font-semibold [&_a]:text-brand-text [&_a]:underline-offset-4 [&_a]:hover:underline">
          No email after a few minutes? Check spam. If you already have an
          account, <Link href="/sign-in">sign in</Link>, continue with Google,
          or <Link href="/reset-password">reset your password</Link>.
        </p>
      </AuthPanel>
    );
  }

  const pending = signUp.isPending;

  return (
    <AuthPanel
      key="form"
      headingRef={heading}
      title="Create your account"
      description="Start working leads in Dealwright."
      footer={
        <>
          Already have an account? <Link href="/sign-in">Sign in</Link>
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
          const { data, errors: found } = readForm(signUpSchema, form);
          setErrors(found ?? {});
          if (!data) return;

          const { password: _password, ...values } = data;
          setKept(values);
          signUp.mutate(data, {
            // Always "Check your email", whatever Supabase answered: the same
            // state is shown whether or not the address was already known.
            onSuccess: () => {
              swapped.current = true;
              setSentTo(data.email);
            },
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
        {signUp.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {authErrorMessage(signUp.error)}
            </AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="First name"
              name="firstName"
              autoComplete="given-name"
              defaultValue={kept.firstName}
              error={errors.firstName}
              readOnly={pending}
              required
            />
            <FormField
              label="Last name"
              name="lastName"
              autoComplete="family-name"
              defaultValue={kept.lastName}
              error={errors.lastName}
              readOnly={pending}
              required
            />
          </div>
          <FormField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={kept.email}
            error={errors.email}
            readOnly={pending}
            required
          />
          <FormField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            error={errors.password}
            readOnly={pending}
            required
          />
        </FieldGroup>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={pending}
          disabled={!hydrated}
        >
          Create account
        </Button>
      </form>
      <AuthDivider />
      <GoogleButton next={next} disabled={pending} />
    </AuthPanel>
  );
}
