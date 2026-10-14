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
import { useSyncLog } from "@/hooks/use-sync-log";
import { ApiError } from "@/lib/api/client";
import type { SyncEntry } from "@/lib/sync/schemas";

import { leadHref, PIPELINE_HREF } from "../navigation";

const OUTCOME: Record<
  SyncEntry["outcome"],
  { label: string; tone: "ok" | "neutral" | "crit" }
> = {
  sent: { label: "Sent", tone: "ok" },
  skipped_duplicate: { label: "Skipped, already sent", tone: "neutral" },
  failed: { label: "Failed", tone: "crit" },
};

/**
 * Sync log: every write the app makes to the CRM, newest first (build packet:
 * the visible seam). For admins and owners. Sample data: nothing is sent to a
 * CRM; the entries come from actions taken on the sample leads.
 */
export function SyncLogScreen({
  notAllowed = false,
}: {
  notAllowed?: boolean;
}) {
  const log = useSyncLog(!notAllowed);

  const header = (
    <PageHeader
      title="Sync log"
      description="Every change the app makes in the CRM, newest first. A repeated write is skipped and says so."
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
            <Skeleton key={row} className="h-14 w-full" />
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
          title="The sync log could not be loaded"
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
          title="Nothing has been written yet"
          description="Marking a lead spam or lost, reviewing a suspect, or qualifying a lead adds an entry here."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-panel bg-card ring-1 ring-border">
          {log.data.items.map((entry) => (
            <li key={entry.id}>
              <ListRow
                href={leadHref(entry.lead.id)}
                className="flex min-w-0 flex-col gap-1 nav:flex-row nav:items-center nav:gap-4"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-pretty">{entry.summary}</span>
                  <span className="text-muted-foreground">
                    {entry.lead.name} · by {entry.actor} ·{" "}
                    <span className="font-mono text-xs">
                      {entry.idempotencyKey}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <Badge variant={OUTCOME[entry.outcome].tone}>
                    {OUTCOME[entry.outcome].label}
                  </Badge>
                  <LocalTime
                    value={entry.at}
                    className="text-muted-foreground"
                  />
                </span>
              </ListRow>
            </li>
          ))}
        </ul>
      )}
      <p className="max-w-[65ch] text-pretty text-muted-foreground">
        Sample data: nothing is sent to a CRM. These entries record what would
        be written when the connection is live.
      </p>
    </>
  );
}
