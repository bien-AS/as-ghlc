"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { LinkButton } from "@/components/ui/link-button";
import { LocalTime } from "@/components/ui/local-time";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { PanelSection } from "@/components/ui/panel-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, NotAllowedState } from "@/components/ui/state-panel";
import { toast } from "@/components/ui/toast";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  useChangeMemberRole,
  useInviteMember,
  useMembers,
  useRemoveMember,
  useResendInvite,
  useRevokeInvite,
} from "@/hooks/use-members";
import { ApiError } from "@/lib/api/client";
import { clearErrorOnEdit, type FieldErrors, readForm } from "@/lib/forms";
import {
  inviteExpiresAt,
  MEMBER_LOCK_REASON,
  MEMBER_STATUS_META,
  memberLock,
} from "@/lib/members/rules";
import {
  INVITING_IS_OFFERED,
  inviteInputSchema,
  type Member,
} from "@/lib/members/schemas";
import { ROLE_LABEL, ROLE_SEES, ROLES, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { PIPELINE_HREF, WORKSPACE_SETTINGS_HREF } from "../navigation";

/** The 44px Touch Rule: compact on a desktop, a full target on a phone. */
const TOUCH = "max-nav:min-h-11 pointer-coarse:min-h-11";
const TOUCH_SELECT =
  "max-nav:[&_select]:min-h-11 pointer-coarse:[&_select]:min-h-11";

const linkClass =
  "font-semibold text-brand-text underline-offset-4 hover:underline";

/** Why a write did not happen, in plain words. The list has been reloaded. */
function whyNot(error: unknown, what: string) {
  if (error instanceof ApiError && error.status === 409) {
    return `${what} A Workspace must keep at least one owner.`;
  }
  if (error instanceof ApiError && error.status === 404) {
    return `${what} They are no longer on this list.`;
  }
  return `${what} Try again.`;
}

const roleOptions = ROLES.map((role) => (
  <NativeSelectOption key={role} value={role}>
    {ROLE_LABEL[role]}
  </NativeSelectOption>
));

/**
 * Users and roles (spec 12): who has access to the Workspace and with which
 * role, with invite, change role and remove. For admins and owners; the
 * server refuses anyone else whatever this screen shows.
 */
export function UsersScreen({
  notAllowed = false,
}: {
  /** The server already refused this viewer's role. */
  notAllowed?: boolean;
}) {
  const members = useMembers({ enabled: !notAllowed });
  const inviteForm = useRef<HTMLFormElement>(null);

  const title = (
    <PageHeader
      title="Users and roles"
      description="Who has access to this Workspace, and what each person can see and do."
    />
  );

  const refused =
    notAllowed ||
    (members.error instanceof ApiError && members.error.code === "forbidden");
  if (refused) {
    return (
      <>
        {title}
        <NotAllowedState
          action={
            <LinkButton href={PIPELINE_HREF}>Go to the Pipeline</LinkButton>
          }
        />
      </>
    );
  }
  if (members.isError && !members.data) {
    return (
      <>
        {title}
        <ErrorState
          title="The list of people could not be loaded"
          description="Nothing was changed. Check your connection and try again."
          retrying={members.isFetching}
          onRetry={() => members.refetch()}
        />
      </>
    );
  }

  const people = members.data;

  return (
    <>
      {title}

      {INVITING_IS_OFFERED && <InviteForm ref={inviteForm} />}

      <PanelSection
        aria-label="People with access"
        title={
          people
            ? `People with access (${people.length})`
            : "People with access"
        }
      >
        {people ? (
          <>
            <ul className="divide-y divide-border">
              {people.map((member) => (
                <MemberRow key={member.id} member={member} members={people} />
              ))}
            </ul>
            {people.length === 1 && (
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                <p className="text-pretty">
                  You are the only person here. Invite the people you work with
                  to share the leads.
                </p>
                {INVITING_IS_OFFERED && (
                  <Button
                    className={TOUCH}
                    onClick={() => {
                      const email = inviteForm.current?.elements.namedItem(
                        "email",
                      ) as HTMLInputElement | null;
                      email?.focus();
                    }}
                  >
                    Invite someone
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <output
            aria-label="Loading people"
            className="flex flex-col divide-y divide-border"
          >
            {["a", "b", "c", "d", "e"].map((row) => (
              <div
                key={row}
                className="flex flex-col gap-2 py-3 first:pt-1 last:pb-0 nav:flex-row nav:items-center nav:justify-between"
              >
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-52" />
                </div>
                <Skeleton className="h-8 w-44" />
              </div>
            ))}
          </output>
        )}
      </PanelSection>

      <PanelSection
        aria-label="What each role sees"
        title="What each role sees"
      >
        <dl className="grid gap-x-6 gap-y-2 nav:grid-cols-[6rem_minmax(0,1fr)]">
          {ROLES.map((role) => (
            <div key={role} className="contents">
              <dt className="font-semibold max-nav:mt-1">{ROLE_LABEL[role]}</dt>
              <dd className="text-muted-foreground">{ROLE_SEES[role]}</dd>
            </div>
          ))}
        </dl>
        {/* Question 7: the role names are decided, what each sees is proposed. */}
        <p className="max-w-[65ch] text-pretty text-muted-foreground">
          These are proposed and not decided yet. People whose email is on one
          of the Workspace’s allowed domains may join without an invite; the
          domains are edited in{" "}
          <Link href={WORKSPACE_SETTINGS_HREF} className={linkClass}>
            Workspace settings
          </Link>
          .
        </p>
      </PanelSection>
    </>
  );
}

function InviteForm({ ref }: { ref: React.Ref<HTMLFormElement> }) {
  const invite = useInviteMember();
  const [errors, setErrors] = useState<FieldErrors>({});
  // The submit control is inert until `onSubmit` is attached.
  const hydrated = useHydrated();
  const roleId = useId();
  const pending = invite.isPending;

  return (
    <PanelSection aria-label="Invite someone" title="Invite someone">
      <form
        ref={ref}
        // Never GET: a submit the browser handles itself must not put fields in the address.
        method="post"
        noValidate
        aria-busy={pending}
        onChange={clearErrorOnEdit(setErrors)}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const form = event.currentTarget;
          const { data, errors: found } = readForm(inviteInputSchema, form);
          setErrors(found ?? {});
          if (!data) return;
          invite.mutate(data, {
            onSuccess: () => {
              form.reset();
              toast.add({
                title: `Invite recorded for ${data.email}`,
                type: "success",
              });
            },
            onError: (error) => {
              if (error instanceof ApiError && error.status === 409) {
                setErrors({
                  email: "This address already has access or a pending invite.",
                });
              }
            },
          });
        }}
      >
        {/* Invite failed (spec 12): the address stays in the field. */}
        {invite.isError &&
          !pending &&
          !(
            invite.error instanceof ApiError && invite.error.status === 409
          ) && (
            <Alert variant="destructive">
              <AlertDescription>
                The invite could not be sent. The address is still here; try
                again.
              </AlertDescription>
            </Alert>
          )}
        <div className="grid items-start gap-3 nav:grid-cols-[minmax(0,1fr)_11rem]">
          <FormField
            label="Email"
            name="email"
            type="email"
            autoComplete="off"
            spellCheck={false}
            placeholder="name@example.com"
            error={errors.email}
            readOnly={pending}
            className={TOUCH}
            required
          />
          <Field>
            <FieldLabel htmlFor={roleId}>Role</FieldLabel>
            <NativeSelect
              id={roleId}
              name="role"
              defaultValue={"staff" satisfies Role}
              disabled={pending}
              className={cn("w-full", TOUCH_SELECT)}
            >
              {roleOptions}
            </NativeSelect>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            type="submit"
            variant="primary"
            loading={pending}
            disabled={!hydrated}
            className={TOUCH}
          >
            Send invite
          </Button>
          <p className="text-muted-foreground">
            Sample data: no email is sent.
          </p>
        </div>
      </form>
    </PanelSection>
  );
}

function MemberRow({ member, members }: { member: Member; members: Member[] }) {
  const change = useChangeMemberRole();
  const remove = useRemoveMember();
  const revoke = useRevokeInvite();
  const resend = useResendInvite();
  const noteId = useId();

  const invited = member.status === "invited";
  const who = member.name ?? member.email;
  const lock = memberLock(members, member);
  const busy =
    change.isPending ||
    remove.isPending ||
    revoke.isPending ||
    resend.isPending;

  // The latest refusal on this row; the next write on the row withdraws it.
  const problem = busy
    ? undefined
    : change.isError
      ? whyNot(change.error, "The role was not changed.")
      : remove.isError
        ? whyNot(remove.error, `${who} was not removed.`)
        : revoke.isError
          ? whyNot(revoke.error, "The invite was not revoked.")
          : resend.isError
            ? whyNot(resend.error, "The invite was not sent again.")
            : undefined;

  /** A new write on the row withdraws what the last one said. */
  const clear = () => {
    for (const mutation of [change, remove, revoke, resend]) mutation.reset();
  };
  const write = (mutation: typeof remove, done: string) => {
    clear();
    mutation.mutate(member.id, {
      onSuccess: () => toast.add({ title: done, type: "success" }),
    });
  };

  return (
    <li
      aria-busy={busy || undefined}
      className="flex flex-col gap-2 py-3 first:pt-1 last:pb-0 nav:grid nav:grid-cols-[minmax(0,1fr)_auto] nav:items-center nav:gap-x-4"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold wrap-break-word">{who}</span>
          {member.isViewer && <Badge>You</Badge>}
          {invited && (
            <Badge variant={MEMBER_STATUS_META.invited.tone}>
              {MEMBER_STATUS_META.invited.label}
            </Badge>
          )}
        </p>
        {member.name && (
          <p className="break-all text-muted-foreground">{member.email}</p>
        )}
        {member.invitedAt && (
          <p className="text-muted-foreground">
            Invite sent <LocalTime value={member.invitedAt} format="date" />,
            expires{" "}
            <LocalTime
              value={inviteExpiresAt(member.invitedAt)}
              format="date"
            />
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={`Role for ${who}`}
          aria-describedby={lock ? noteId : undefined}
          // While saving, the choice just made; otherwise what the server holds,
          // so a refused change shows the old value again.
          value={change.isPending ? change.variables.role : member.role}
          disabled={busy || lock !== null}
          onChange={(event) => {
            clear();
            change.mutate({
              id: member.id,
              role: event.target.value as Role,
            });
          }}
          className={cn(
            "w-28",
            TOUCH_SELECT,
            // Locked for good, not for a moment: the role must stay readable.
            lock &&
              "has-[select:disabled]:opacity-100 [&_select]:text-muted-foreground",
          )}
        >
          {roleOptions}
        </NativeSelect>
        {invited ? (
          <>
            <Button
              aria-label={`Send the invite to ${who} again`}
              loading={resend.isPending}
              disabled={busy}
              className={TOUCH}
              onClick={() => write(resend, `Invite recorded again for ${who}`)}
            >
              Send again
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  variant="danger"
                  aria-label={`Revoke the invite for ${who}`}
                  loading={revoke.isPending}
                  disabled={busy}
                  className={TOUCH}
                >
                  Revoke
                </Button>
              }
              title={`Revoke the invite for ${who}?`}
              description="The invite stops working at once. You can invite this address again later."
              confirmLabel="Revoke invite"
              onConfirm={() => write(revoke, `Invite revoked for ${who}`)}
            />
          </>
        ) : (
          !member.isViewer && (
            <ConfirmDialog
              trigger={
                <Button
                  variant="danger"
                  aria-label={`Remove ${who}`}
                  aria-describedby={lock ? noteId : undefined}
                  loading={remove.isPending}
                  disabled={busy || lock !== null}
                  className={TOUCH}
                >
                  Remove
                </Button>
              }
              title={`Remove ${who}?`}
              description={`${who} loses access to this Workspace at once.`}
              confirmLabel="Remove"
              onConfirm={() => write(remove, `Removed ${who}`)}
            />
          )
        )}
      </div>

      {(lock || change.isPending || problem) && (
        <div className="flex flex-col gap-1 nav:col-span-2">
          {lock && (
            <p id={noteId} className="text-pretty text-muted-foreground">
              {MEMBER_LOCK_REASON[lock]}
            </p>
          )}
          {change.isPending && (
            <output className="text-muted-foreground">Saving the role…</output>
          )}
          {problem && (
            <p role="alert" className="text-pretty text-destructive">
              {problem}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
