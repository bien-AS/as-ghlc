import { InfoIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One line under a lead's actions saying what to do next and why (spec 03).
 * A polite live region: when an action changes the lead, the new hint is read out.
 */
function HintLine({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      data-slot="hint-line"
      aria-live="polite"
      className={cn(
        "flex items-start gap-1.5 text-pretty text-muted-foreground",
        className,
      )}
    >
      <InfoIcon aria-hidden="true" className="mt-[3px] size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export { HintLine };
