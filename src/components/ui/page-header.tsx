import { cn } from "@/lib/utils";

/**
 * The top of a dashboard screen: its heading, an optional line under it and
 * optional actions. The heading can take focus, so the shell can move focus to
 * it after navigation (spec 04, "Keyboard access").
 */
function PageHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Chips or other details under the heading. */
  children?: React.ReactNode;
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1
          tabIndex={-1}
          className="text-2xl leading-tight wrap-break-word outline-none"
        >
          {title}
        </h1>
        {description && (
          <p className="max-w-[65ch] text-pretty text-muted-foreground">
            {description}
          </p>
        )}
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      )}
    </header>
  );
}

export { PageHeader };
