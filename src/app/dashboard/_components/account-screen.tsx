"use client";

import { useId, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PageHeader } from "@/components/ui/page-header";
import { PanelSection } from "@/components/ui/panel-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state-panel";
import { Switch } from "@/components/ui/switch";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import {
  useAccountPreferences,
  useUpdateAccountPreferences,
} from "@/hooks/use-account";
import { useCurrentUser, useUpdateProfile } from "@/hooks/use-auth";
import { useHydrated } from "@/hooks/use-hydrated";
import { ApiError } from "@/lib/api/client";
import { type CurrentUser, profileSchema } from "@/lib/auth/schemas";
import { clearErrorOnEdit, type FieldErrors, readForm } from "@/lib/forms";
import {
  NOTIFICATION_TYPE_LABEL,
  NOTIFICATION_TYPE_WHEN,
} from "@/lib/notifications/rules";
import {
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/lib/notifications/schemas";

/** At least 44px tall below `nav` and on a coarse pointer (The 44px Touch Rule). */
const TOUCH = "max-nav:min-h-11 pointer-coarse:min-h-11";

/**
 * Account settings: the person's own name, theme and notification
 * preferences. Reached from the user menu; the Workspace's settings are a
 * different screen.
 */
export function AccountScreen() {
  return (
    <>
      <PageHeader
        title="Account settings"
        description="Your own name, theme and notifications. They apply to you only."
      />
      <div className="flex max-w-2xl flex-col gap-6">
        <ProfilePanel />
        <PanelSection title="Theme">
          <ThemeSwitch />
          <p className="text-muted-foreground">
            Your choice is kept in this browser.
          </p>
        </PanelSection>
        <NotificationPreferencesPanel />
      </div>
    </>
  );
}

function ProfilePanel() {
  const me = useCurrentUser();

  return (
    <PanelSection title="Profile">
      {me.data ? (
        <ProfileForm user={me.data} />
      ) : me.isError ? (
        <ErrorState
          title="Your profile could not be loaded"
          description="Nothing was changed. Check your connection and try again."
          retrying={me.isFetching}
          onRetry={() => me.refetch()}
        />
      ) : (
        <output aria-label="Loading profile" className="flex flex-col gap-5">
          <div className="grid gap-3 nav:grid-cols-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <Skeleton className="h-14" />
          <Skeleton className="h-8 w-28" />
        </output>
      )}
    </PanelSection>
  );
}

function ProfileForm({ user }: { user: CurrentUser }) {
  const update = useUpdateProfile();
  const [errors, setErrors] = useState<FieldErrors>({});
  // "Saved" stands until the next edit, so it never describes unsaved text.
  const [saved, setSaved] = useState(false);
  // The submit control is inert until `onSubmit` is attached.
  const hydrated = useHydrated();
  // A 401 or "profile required" answer is already navigating elsewhere.
  const redirecting =
    update.error instanceof ApiError &&
    (update.error.status === 401 || update.error.code === "profile_required");
  const withdrawError = clearErrorOnEdit(setErrors);

  return (
    <form
      // Never GET: a submit the browser handles itself must not put fields in the address.
      method="post"
      noValidate
      aria-busy={update.isPending}
      onChange={(event) => {
        withdrawError(event);
        setSaved(false);
      }}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (update.isPending) return;
        const { data, errors: found } = readForm(
          profileSchema,
          event.currentTarget,
        );
        setErrors(found ?? {});
        if (!data) return;
        update.mutate(data, { onSuccess: () => setSaved(true) });
      }}
    >
      {update.isError && !redirecting && (
        <Alert variant="destructive">
          <AlertDescription>
            We could not save your name. Try again.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-x-3 gap-y-5 nav:grid-cols-2">
        <FormField
          label="First name"
          name="firstName"
          autoComplete="given-name"
          defaultValue={user.firstName}
          error={errors.firstName}
          readOnly={update.isPending}
          required
          className={TOUCH}
        />
        <FormField
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          defaultValue={user.lastName}
          error={errors.lastName}
          readOnly={update.isPending}
          required
          className={TOUCH}
        />
      </div>
      {/* No `name`: the email is never part of what the form submits. */}
      <FormField
        label="Email"
        type="email"
        value={user.email}
        readOnly
        hint="From the account you signed in with. It cannot be changed here."
        className={TOUCH}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="submit"
          variant="primary"
          loading={update.isPending}
          disabled={!hydrated}
          className={TOUCH}
        >
          Save name
        </Button>
        <p aria-live="polite" className="text-muted-foreground">
          {saved
            ? "Saved."
            : "This is your real profile, not sample data. Teammates see this name."}
        </p>
      </div>
    </form>
  );
}

function NotificationPreferencesPanel() {
  const preferences = useAccountPreferences();
  const update = useUpdateAccountPreferences();
  // While a change is being saved the switches show what was asked for; if it
  // fails they return to what the server last said.
  const shown = update.isPending ? update.variables : preferences.data;

  return (
    <PanelSection title="Notification preferences">
      <p className="max-w-[65ch] text-pretty text-muted-foreground">
        In Dealwright only. A type you switch off is left out of your
        notifications and your unread count.
      </p>
      {shown ? (
        <ul className="divide-y divide-border border-y border-border">
          {NOTIFICATION_TYPES.map((type) => (
            <PreferenceRow
              key={type}
              type={type}
              checked={shown.notifications[type]}
              onChange={(checked) =>
                update.mutate({
                  notifications: { ...shown.notifications, [type]: checked },
                })
              }
            />
          ))}
        </ul>
      ) : preferences.isError ? (
        <ErrorState
          title="Your preferences could not be loaded"
          description="Nothing was changed. Check your connection and try again."
          retrying={preferences.isFetching}
          onRetry={() => preferences.refetch()}
        />
      ) : (
        <output
          aria-label="Loading preferences"
          className="flex flex-col gap-3 py-1"
        >
          {NOTIFICATION_TYPES.map((type) => (
            <Skeleton key={type} className="h-10" />
          ))}
        </output>
      )}
      {update.isError && (
        <p role="alert" className="text-crit">
          That choice could not be saved. Try again.
        </p>
      )}
      <p className="text-muted-foreground">
        Sample data: these choices reset when the server restarts.
      </p>
    </PanelSection>
  );
}

function PreferenceRow({
  type,
  checked,
  onChange,
}: {
  type: NotificationType;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <li className="flex min-h-11 items-center justify-between gap-4 py-2.5">
      <span className="flex min-w-0 flex-col">
        <span id={`${id}-label`} className="font-semibold">
          {NOTIFICATION_TYPE_LABEL[type]}
        </span>
        <span id={`${id}-when`} className="text-muted-foreground">
          {NOTIFICATION_TYPE_WHEN[type]}
        </span>
      </span>
      <Switch
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-when`}
        checked={checked}
        onCheckedChange={onChange}
      />
    </li>
  );
}
