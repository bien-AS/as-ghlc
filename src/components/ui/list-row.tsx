import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * A row in a list (spec 03). The whole row is one link. Hover uses surface-2;
 * the selected row carries a brand left edge and is announced as current.
 */
function ListRow({
  href,
  selected = false,
  disabled = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string;
  selected?: boolean;
  /** Not followable for now, for example while a decision is being saved. */
  disabled?: boolean;
}) {
  return (
    <Link
      data-slot="list-row"
      href={href}
      aria-current={selected ? "true" : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={cn(
        "block px-4 py-2.5 outline-none hover:bg-secondary focus-visible:bg-secondary focus-visible:shadow-[inset_0_0_0_2px_var(--ink)] aria-disabled:pointer-events-none aria-disabled:opacity-40",
        selected &&
          "bg-secondary shadow-[inset_2px_0_0_var(--brand)] focus-visible:shadow-[inset_2px_0_0_var(--brand),inset_0_0_0_2px_var(--ink)]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/** The name on a row. A removed lead's name is struck through, and said to be removed. */
function ListRowName({
  removed = false,
  className,
  children,
}: {
  removed?: boolean;
  className?: string;
  children: string;
}) {
  return (
    <span
      data-slot="list-row-name"
      title={children}
      className={cn("block truncate font-semibold", className)}
    >
      {removed ? (
        <>
          <s className="text-muted-foreground">{children}</s>
          <span className="sr-only"> (left the pipeline)</span>
        </>
      ) : (
        children
      )}
    </span>
  );
}

export { ListRow, ListRowName };
