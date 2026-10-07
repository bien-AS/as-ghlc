import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/** Empty state (spec 03): a short heading, one sentence and an optional action. */
function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Empty
      data-slot="empty-state"
      className={cn("flex-none border border-border py-10", className)}
    >
      <EmptyHeader>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

/**
 * Error state (spec 03): what failed in plain words and a "Try again" action.
 * Announced when it appears.
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
    <Empty
      data-slot="error-state"
      role="alert"
      className={cn("flex-none border border-border py-10", className)}
    >
      <EmptyHeader>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {(onRetry || action) && (
        <EmptyContent className="flex-row flex-wrap justify-center">
          {onRetry && (
            <Button loading={retrying} onClick={onRetry}>
              Try again
            </Button>
          )}
          {action}
        </EmptyContent>
      )}
    </Empty>
  );
}

/**
 * Not allowed (spec 12): the viewer's role cannot use this screen. The server
 * has already refused; this only says so, and offers the way back.
 */
function NotAllowedState({
  action,
  className,
}: {
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <EmptyState
      title="You do not have access to this screen"
      description="It is for admins and owners of the Workspace. Ask one of them if you need something changed here."
      action={action}
      className={className}
    />
  );
}

export { EmptyState, ErrorState, NotAllowedState };
