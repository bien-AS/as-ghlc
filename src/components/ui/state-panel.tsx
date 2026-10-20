"use client";

import {
  type EmptyStateVariant,
  EmptyState as KitEmptyState,
} from "@vantage/design-system";
import { LockIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * The state library (registry: empty-state-library, error-state-library).
 * Every screen says "nothing here", "that failed" and "not for you" with these
 * three, so the patterns cannot drift. The frame is a 1px boundary with no
 * resting shadow (RULES.md, section 3); the inside is the kit's EmptyState
 * layout, so an error reads as the same family as an empty list.
 */

const FRAME = "rounded-panel border border-border";
/** Replaces a skeleton or a list without a jump: opacity only, 150ms. */
const ENTER = "animate-in fade-in duration-150 ease-out";

/**
 * Empty state: the kit's `EmptyState`. `variant` is required, as in the kit,
 * because "nothing yet", "your filters hide it" and "never connected" are
 * different facts with different ways out (RULES.md, section 5). Copy per
 * screen is the registry's `states.empty`.
 */
function EmptyState({
  variant,
  title,
  body,
  action,
  provider,
  className,
}: {
  variant: EmptyStateVariant;
  title: string;
  body: string;
  /** The way out: Clear filters for `filtered`, the first step for `empty`. */
  action?: React.ReactNode;
  /** `notConnected` only: which connection is missing. */
  provider?: string;
  className?: string;
}) {
  return (
    <KitEmptyState
      data-slot="empty-state"
      variant={variant}
      title={title}
      body={body}
      action={action}
      provider={provider}
      className={cn(FRAME, ENTER, className)}
    />
  );
}

/** The kit's EmptyState layout, for the states that are not about absent data. */
function StatePanel({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        FRAME,
        ENTER,
        "flex flex-col items-center gap-2 px-6 py-14 text-center",
        className,
      )}
      {...props}
    >
      <span className="mb-1 text-ink-3">{icon}</span>
      <p className="text-small font-bold text-ink">{title}</p>
      {description && (
        <div className="max-w-[42ch] text-meta leading-relaxed text-pretty text-ink-2">
          {description}
        </div>
      )}
      {action && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}

/**
 * Error state (500 and failed reads): what failed in plain words and a "Try
 * again" action. Announced when it appears.
 */
function ErrorState({
  title,
  description,
  onRetry,
  retrying = false,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  /** A second way out, beside Try again. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <StatePanel
      data-slot="error-state"
      role="alert"
      icon={<TriangleAlertIcon size={24} aria-hidden="true" />}
      title={title}
      description={description}
      action={
        (onRetry || action) && (
          <>
            {onRetry && (
              <Button loading={retrying} onClick={onRetry}>
                Try again
              </Button>
            )}
            {action}
          </>
        )
      }
      className={className}
    />
  );
}

/**
 * Forbidden (403, a role-gated fetch): the viewer's role cannot use this. The
 * server has already refused; this only says so and offers the way back.
 * Refusals at sign-in go to /access-denied instead.
 */
function ForbiddenState({
  action,
  className,
}: {
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <StatePanel
      data-slot="forbidden-state"
      icon={<LockIcon size={24} aria-hidden="true" />}
      title="You do not have access"
      description="This is for admins. Ask one of them if you need something here."
      action={action}
      className={className}
    />
  );
}

export { EmptyState, ErrorState, ForbiddenState };
