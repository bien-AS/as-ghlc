import { cn } from "@/lib/utils";

const DOT = {
  neutral: "bg-muted-foreground",
  brand: "bg-brand",
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
} as const;

/**
 * A lead's status as one line in a dense list: the words, with a small toned
 * dot in front. The dot only supports the words; it never stands alone.
 */
function StatusLine({
  tone,
  className,
  children,
}: {
  tone: keyof typeof DOT;
  className?: string;
  children: string;
}) {
  return (
    <span
      data-slot="status-line"
      title={children}
      className={cn("flex min-w-0 items-center gap-1.5", className)}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", DOT[tone])}
      />
      <span className="truncate">{children}</span>
    </span>
  );
}

export { StatusLine };
