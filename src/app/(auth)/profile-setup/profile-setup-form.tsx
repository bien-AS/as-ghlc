"use client";

import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthPanel } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { useCreateProfile, useSignOut } from "@/hooks/use-auth";
import { useHydrated } from "@/hooks/use-hydrated";
import { ApiError } from "@/lib/api/client";
import { profileSchema } from "@/lib/auth/schemas";
import { clearErrorOnEdit, type FieldErrors, readForm } from "@/lib/forms";
import { navigate } from "@/lib/navigate";

function saveErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "email_conflict") {
    return "Another profile already uses this email. Sign out, then sign in the way you did originally.";
  }
  return "We could not save your profile. Try again.";
}

export function ProfileSetupForm({
  email,
  defaults,
}: {
  /** From the verified session. Shown, never edited and never submitted. */
  email: string;
  defaults: { firstName: string; lastName: string };
}) {
  const create = useCreateProfile();
  const signOut = useSignOut();
  const [errors, setErrors] = useState<FieldErrors>({});
  // The submit control is inert until `onSubmit` is attached.
  const hydrated = useHydrated();

  // Stays "pending" after success: the page is about to be replaced.
  const pending = create.isPending || create.isSuccess;
  const leaving = signOut.isPending || signOut.isSuccess;
  // A 401 or "profile required" answer is already navigating elsewhere.
  const redirecting =
    create.error instanceof ApiError &&
    (create.error.status === 401 || create.error.code === "profile_required");

  return (
    <AuthPanel
      title="Set up your profile"
      description="Check your name. This is how teammates will see you in Dealwright."
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
          if (pending || leaving) return;
          const { data, errors: found } = readForm(
            profileSchema,
            event.currentTarget,
          );
          setErrors(found ?? {});
          if (!data) return;
          create.mutate(data, { onSuccess: () => navigate("/dashboard") });
        }}
      >
        {create.isError && !redirecting && (
          <Alert variant="destructive">
            <AlertDescription>
              {saveErrorMessage(create.error)}
            </AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="First name"
              name="firstName"
              autoComplete="given-name"
              defaultValue={defaults.firstName}
              error={errors.firstName}
              readOnly={pending}
              required
            />
            <FormField
              label="Last name"
              name="lastName"
              autoComplete="family-name"
              defaultValue={defaults.lastName}
              error={errors.lastName}
              readOnly={pending}
              required
            />
          </div>
          {/* No `name`: the email is never part of what the form submits. */}
          <FormField
            label="Email"
            type="email"
            value={email}
            readOnly
            hint="From the account you signed in with."
          />
        </FieldGroup>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={pending}
          disabled={leaving || !hydrated}
        >
          Continue
        </Button>
      </form>
      <Button
        variant="link"
        className="self-center"
        loading={leaving}
        disabled={pending}
        onClick={() => {
          if (!leaving) signOut.mutate();
        }}
      >
        Sign out
      </Button>
    </AuthPanel>
  );
}
