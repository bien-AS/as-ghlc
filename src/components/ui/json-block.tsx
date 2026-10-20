import { cn } from "@/lib/utils";

/**
 * A recorded request, response or payload, pretty-printed for reading
 * (the sync log's payload drawer; the validation log's inputs). Long values
 * wrap instead of scrolling sideways, so the block never widens its container.
 * Whatever is passed is shown as it is: redact before storing, not here.
 */
function JsonBlock({
  value,
  className,
}: {
  /** Anything JSON can print. Null or undefined reads as nothing recorded. */
  value: unknown;
  className?: string;
}) {
  if (value === null || value === undefined) {
    return (
      <p data-slot="json-block" className={cn("text-ink-3", className)}>
        Nothing recorded.
      </p>
    );
  }
  return (
    <pre
      data-slot="json-block"
      className={cn(
        "rounded-md border border-line bg-surface-inset p-3 font-mono text-meta leading-relaxed wrap-anywhere whitespace-pre-wrap text-ink",
        className,
      )}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export { JsonBlock };
