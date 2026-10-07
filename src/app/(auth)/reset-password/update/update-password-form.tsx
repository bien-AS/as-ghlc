"use client";

import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthPanel } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useUpdatePassword } from "@/hooks/use-auth";
import { useHydrated } from "@/hooks/use-hydrated";
import { authErrorMessage, isSessionMissing } from "@/lib/auth/errors";
import { NOTICE } from "@/lib/auth/routing";
import { PASSWORD_MIN_LENGTH, updatePasswordSchema } from "@/lib/auth/schemas";
import { clearErrorOnEdit, type FieldErrors, readForm } from "@/lib/forms";
import { navigate } from "@/lib/navigate";

export function UpdatePasswordForm() {
  const update = useUpdatePassword();
  const [errors, setErrors] = useState<FieldErrors>({});
  // The submit control is inert until `onSubmit` is attached.
  const hydrated = useHydrated();

  // Stays "pending" after success: the page is about to be replaced.
  const pending = update.isPending || update.isSuccess;
  const sessionGone = update.isError && isSessionMissing(update.error);

  return (
    <AuthPanel
      title="Choose a new password"
      description="You will stay signed in after saving it."
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
          const { data, errors: found } = readForm(updatePasswordSchema, form);
          setErrors(found ?? {});
          if (!data) return;
          update.mutate(data, {
            onSuccess: () => navigate("/dashboard"),
            onError: (error) => {
              if (isSessionMissing(error)) {
                navigate(`/reset-password?notice=${NOTICE.linkInvalid}`);
                return;
              }
              const password = form.elements.namedItem("password");
              if (password instanceof HTMLInputElement) password.focus();
            },
          });
        }}
      >
        {update.isError && !sessionGone && (
          <Alert variant="destructive">
            <AlertDescription>
              {authErrorMessage(update.error)}
            </AlertDescription>
          </Alert>
        )}
        <FormField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          error={errors.password}
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
          Save password
        </Button>
      </form>
    </AuthPanel>
  );
}
