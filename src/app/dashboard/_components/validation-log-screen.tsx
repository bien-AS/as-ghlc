"use client";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { ListRow } from "@/components/ui/list-row";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  ErrorState,
  NotAllowedState,
} from "@/components/ui/state-panel";
import { useValidationLog } from "@/hooks/use-validation-log";
import { ApiError } from "@/lib/api/client";
import type { ValidationEntry } from "@/lib/validation/schemas";

import { leadHref, PIPELINE_HREF } from "../navigation";

const RESULT: Record<
  ValidationEntry["result"],
  { label: string; tone: "ok" | "warn" | "crit" }
> = {
  valid: { label: "Valid", tone: "ok" },
  suspect: { label: "Suspect", tone: "warn" },
  spam: { label: "Spam", tone: "crit" },
};

const OVERRIDE_TEXT: Record<
  NonNullable<ValidationEntry["override"]>["outcome"],
  string
> = {
  cleared: "cleared as valid",
  spam: "confirmed as spam",
};

/**
 * Validation log: every verdict the AI gave, what it was based on, what it
 * cost, and any override by a rep. For admins and owners. Sample data: the
 * entries come from the sample leads, and no cost was measured.
 */
export function ValidationLogScreen({
  notAllowed = false,
}: {
  notAllowed?: boolean;
}) {
  const log = useValidationLog(!notAllowed);

  const header = (
    <PageHeader
      title="Validation log"
      description="Every verdict on a lead, what it was based on, and whether a rep changed it. Newest first."
    />
  );

  const refused =
    notAllowed ||
    (log.error instanceof ApiError && log.error.code === "forbidden");
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
  if (log.isPending) {
    return (
      <>
        {header}
        <output aria-label="Loading" className="flex flex-col gap-2">
          {["a", "b", "c", "d"].map((row) => (
            <Skeleton key={row} className="h-16 w-full" />
          ))}
        </output>
      </>
    );
  }
  if (log.isError && !log.data) {
    return (
      <>
        {header}
        <ErrorState
          title="The validation log could not be loaded"
          description="Nothing was changed. Check your connection and try again."
          retrying={log.isFetching}
          onRetry={() => log.refetch()}
        />
      </>
    );
  }

  return (
    <>
      {header}
      {log.data.items.length === 0 ? (
        <EmptyState
          title="No verdicts yet"
          description="Each new lead is checked once. Its verdict appears here."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-panel bg-card ring-1 ring-border">
          {log.data.items.map((entry) => (
            <li key={entry.id}>
              <ListRow
                href={leadHref(entry.lead.id)}
                className="flex min-w-0 flex-col gap-1 nav:flex-row nav:items-start nav:gap-4"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge variant={RESULT[entry.result].tone}>
                      {RESULT[entry.result].label}
                    </Badge>
                    <span className="font-semibold">{entry.lead.name}</span>
                    {entry.lead.company && (
                      <span className="text-muted-foreground">
                        {entry.lead.company}
                      </span>
                    )}
                  </span>
                  <span className="text-pretty">{entry.summary}</span>
                  {entry.reasons.length > 0 && (
                    <span className="text-pretty text-muted-foreground">
                      Based on: {entry.reasons.join("; ")}
                    </span>
                  )}
                  {entry.override && (
                    <span className="text-pretty">
                      {entry.override.by}{" "}
                      {OVERRIDE_TEXT[entry.override.outcome]} on{" "}
                      <LocalTime value={entry.override.at} format="date" />.
                    </span>
                  )}
                </span>
                <span className="flex flex-col items-start gap-1 text-muted-foreground nav:items-end">
                  <LocalTime value={entry.at} />
                  <span>
                    Cost: {entry.cost === null ? "Not measured" : entry.cost}
                  </span>
                </span>
              </ListRow>
            </li>
          ))}
        </ul>
      )}
      <p className="max-w-[65ch] text-pretty text-muted-foreground">
        Sample data: these verdicts come from the sample leads. No cost was
        measured, so none is shown.
      </p>
    </>
  );
}
