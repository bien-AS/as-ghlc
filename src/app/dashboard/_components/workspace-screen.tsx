"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PanelSection } from "@/components/ui/panel-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, NotAllowedState } from "@/components/ui/state-panel";
import { toast } from "@/components/ui/toast";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  useAddAllowedDomain,
  useRemoveAllowedDomain,
  useUpdateWorkspace,
  useWorkspace,
} from "@/hooks/use-workspace";
import { ApiError } from "@/lib/api/client";
import { clearErrorOnEdit, type FieldErrors, readForm } from "@/lib/forms";
import {
  joinRuleText,
  WORKSPACE_SELF_SERVE,
  workspaceScopeText,
} from "@/lib/workspace/rules";
import {
  domainInputSchema,
  updateWorkspaceSchema,
  type Workspace,
} from "@/lib/workspace/schemas";

import { PIPELINE_HREF, USERS_HREF } from "../navigation";

/** The 44px Touch Rule: taller below `nav` and on a coarse pointer. */
const TOUCH = "max-nav:min-h-11 pointer-coarse:min-h-11";

const linkClass =
  "font-semibold text-brand-text underline-offset-4 hover:underline";

const FAILED = "That did not save. Nothing was changed. Try again.";

/**
 * Workspace settings (spec 16, split from Integrations by owner decision):
 * the Workspace's name, its branding and who can join it. For admins and
 * owners; the server refuses everyone else, and this only says so.
 */
export function WorkspaceScreen({
  notAllowed = false,
}: {
  /** The server already refused this viewer's role. */
  notAllowed?: boolean;
}) {
  const workspace = useWorkspace(!notAllowed);

  const header = (
    <PageHeader
      title="Workspace settings"
      description="The name, branding and join rule of this Workspace."
    />
  );

  const refused =
    notAllowed ||
    (workspace.error instanceof ApiError &&
      workspace.error.code === "forbidden");
  if (refused) {
    return (
      <>
        {header}
        <NotAllowedState
          action={
            <LinkButton href={PIPELINE_HREF}>Back to the Pipeline</LinkButton>
          }
        />
      </>
    );
  }
  if (workspace.isPending) {
    return (
      <>
        {header}
        <WorkspaceSkeleton />
      </>
    );
  }
  if (workspace.isError && !workspace.data) {
    return (
      <>
        {header}
        <ErrorState
          title="The Workspace settings could not be loaded"
          description="Nothing was changed. Check your connection and try again."
          retrying={workspace.isFetching}
          onRetry={() => workspace.refetch()}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <DetailsForm workspace={workspace.data} />
        <JoinPanel domains={workspace.data.allowedDomains} />
      </div>
    </>
  );
}

/** The name and the branding: one form, saved together. */
function DetailsForm({ workspace }: { workspace: Workspace }) {
  const update = useUpdateWorkspace();
  // The submit control is inert until `onSubmit` is attached.
  const hydrated = useHydrated();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [preview, setPreview] = useState(workspace.branding);
  const clearError = clearErrorOnEdit(setErrors);

  return (
    <form
      // Never GET: a submit the browser handles itself must not put fields in the address.
      method="post"
      noValidate
      aria-busy={update.isPending}
      className="flex flex-col gap-4"
      onChange={(event) => {
        clearError(event);
        const values = new FormData(event.currentTarget);
        setPreview({
          displayName: String(values.get("displayName") ?? ""),
          logoInitials: String(values.get("logoInitials") ?? ""),
        });
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (update.isPending) return;
        const { data, errors: found } = readForm(
          updateWorkspaceSchema,
          event.currentTarget,
        );
        setErrors(found ?? {});
        if (!data) return;
        update.mutate(data, {
          onSuccess: () =>
            toast.add({ title: "Workspace settings saved", type: "success" }),
        });
      }}
    >
      <PanelSection title="Workspace">
        <FormField
          label="Name"
          name="name"
          autoComplete="off"
          defaultValue={workspace.name}
          error={errors.name}
          readOnly={update.isPending}
          required
          className={TOUCH}
        />
        <p className="max-w-[65ch] text-pretty text-muted-foreground">
          {workspaceScopeText()}
          {!WORKSPACE_SELF_SERVE &&
            " A Workspace cannot be created or deleted here."}
        </p>
      </PanelSection>

      <PanelSection title="Branding">
        <div className="grid gap-x-3 gap-y-5 nav:grid-cols-[minmax(0,1fr)_9rem]">
          <FormField
            label="Display name"
            name="displayName"
            autoComplete="off"
            defaultValue={workspace.branding.displayName}
            error={errors.displayName}
            readOnly={update.isPending}
            required
            className={TOUCH}
          />
          <FormField
            label="Logo initials"
            name="logoInitials"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={3}
            defaultValue={workspace.branding.logoInitials}
            error={errors.logoInitials}
            readOnly={update.isPending}
            required
            className={`uppercase ${TOUCH}`}
          />
        </div>
        <BrandingPreview {...preview} />
        <p className="max-w-[65ch] text-pretty text-muted-foreground">
          This is how the Workspace is named to your team. The look of
          Dealwright itself does not change.
        </p>
      </PanelSection>

      {update.isError && (
        <Alert variant="destructive">
          <AlertDescription>{FAILED}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        variant="primary"
        className={`self-start ${TOUCH}`}
        loading={update.isPending}
        disabled={!hydrated}
      >
        Save changes
      </Button>
    </form>
  );
}

/** The branding as typed, drawn from tokens. It follows the fields before they are saved. */
function BrandingPreview({ displayName, logoInitials }: Workspace["branding"]) {
  const initials = logoInitials.trim().toUpperCase().slice(0, 3);
  const name = displayName.trim();
  return (
    <figure
      data-slot="branding-preview"
      className="flex flex-col gap-1.5"
      aria-label="Branding preview"
    >
      <figcaption className="text-muted-foreground">Preview</figcaption>
      <div className="flex items-center gap-3 rounded-control border border-border p-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft font-heading text-sm font-semibold text-brand-text"
        >
          {initials}
        </span>
        <span className="min-w-0 truncate font-heading text-base font-semibold">
          {name || <span className="text-muted-foreground">No name yet</span>}
        </span>
      </div>
    </figure>
  );
}

/** The allowed email domains (spec 12), with the join rule in one sentence. */
function JoinPanel({ domains }: { domains: string[] }) {
  const add = useAddAllowedDomain();
  const remove = useRemoveAllowedDomain();
  const hydrated = useHydrated();
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <PanelSection title="Who can join">
      <p className="max-w-[65ch] text-pretty text-muted-foreground">
        {joinRuleText()} Invites are sent from{" "}
        <Link href={USERS_HREF} className={linkClass}>
          Users and roles
        </Link>
        .
      </p>

      {domains.length > 0 ? (
        <ul
          aria-label="Allowed email domains"
          className="flex flex-col divide-y divide-border border-y border-border"
        >
          {domains.map((domain) => (
            <li
              key={domain}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0 font-semibold break-all">{domain}</span>
              <ConfirmDialog
                trigger={
                  <Button
                    size="sm"
                    className={`shrink-0 ${TOUCH}`}
                    loading={remove.isPending && remove.variables === domain}
                    // Each row's button says which domain it removes.
                    aria-label={`Remove ${domain}`}
                  >
                    Remove
                  </Button>
                }
                title={`Remove ${domain}?`}
                description="People on this domain will need an invite to join. People who have already joined keep their access."
                confirmLabel="Remove domain"
                onConfirm={() =>
                  remove.mutate(domain, {
                    onSuccess: () =>
                      toast.add({
                        title: `Removed ${domain}`,
                        type: "success",
                      }),
                  })
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-y border-border py-3">
          No domain is allowed. People can join only with an invite.
        </p>
      )}
      {remove.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            That domain could not be removed. Nothing was changed. Try again.
          </AlertDescription>
        </Alert>
      )}

      <form
        method="post"
        noValidate
        aria-busy={add.isPending}
        className="flex flex-col gap-3"
        onChange={clearErrorOnEdit(setErrors)}
        onSubmit={(event) => {
          event.preventDefault();
          if (add.isPending) return;
          const form = event.currentTarget;
          const { data, errors: found } = readForm(domainInputSchema, form);
          setErrors(found ?? {});
          if (!data) return;
          add.mutate(data.domain, {
            onSuccess: () => {
              form.reset();
              toast.add({ title: `Added ${data.domain}`, type: "success" });
            },
            onError: (error) =>
              setErrors({
                domain:
                  error instanceof ApiError && error.status === 409
                    ? "This domain is already allowed."
                    : "That domain could not be added. Try again.",
              }),
          });
        }}
      >
        <FormField
          label="Email domain"
          name="domain"
          placeholder="example.com"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="url"
          error={errors.domain}
          readOnly={add.isPending}
          className={TOUCH}
        />
        <Button
          type="submit"
          className={`self-start ${TOUCH}`}
          loading={add.isPending}
          disabled={!hydrated}
        >
          Add domain
        </Button>
      </form>
    </PanelSection>
  );
}

function WorkspaceSkeleton() {
  return (
    <output
      aria-label="Loading Workspace settings"
      className="flex w-full max-w-2xl flex-col gap-4"
    >
      <Skeleton className="h-36 rounded-panel" />
      <Skeleton className="h-64 rounded-panel" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-56 rounded-panel" />
    </output>
  );
}
