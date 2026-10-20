"use client";

import { Badge } from "@/components/ui/badge";
import { ListRow, ListRowName } from "@/components/ui/list-row";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { PanelSection } from "@/components/ui/panel-section";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import { useDashboard } from "@/hooks/use-leads";
import { useViewer } from "@/hooks/use-viewer";
import { isLive } from "@/lib/flags";
import type { Dashboard } from "@/lib/leads/schemas";
import { cn } from "@/lib/utils";

import {
  DECKS_HREF,
  LEADS_HREF,
  leadHref,
  PROPOSALS_HREF,
  REVIEW_QUEUE_HREF,
} from "../navigation";

/*
 * The dashboard (spec 07; registry `dashboard`): three live counts, what needs
 * the viewer now, and the latest activity. The server scopes every number and
 * row to the viewer's leads (a rep's own, an admin's all); this screen only
 * says which. Nothing links to a screen that is not live (check 5).
 */

type NeedsYou = Dashboard["needsYou"][number];

const REASONS: Record<
  NeedsYou["reason"],
  { label: string; tone: "crit" | "warn"; when: string }
> = {
  // Red, as the Suspect verdict pill is everywhere else.
  suspect: { label: "Suspect", tone: "crit", when: "Waiting since" },
  call_without_deck: { label: "No deck", tone: "warn", when: "Call" },
  past_threshold: { label: "Overdue", tone: "warn", when: "Quiet since" },
};

/** The lead a row belongs to, as a link only while lead detail is live. */
function LeadRow({
  leadId,
  className,
  children,
}: {
  leadId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return isLive("lead-detail") ? (
    <ListRow href={leadHref(leadId)} className={cn("-mx-4", className)}>
      {children}
    </ListRow>
  ) : (
    <div className={cn("py-2.5", className)}>{children}</div>
  );
}

export function DashboardScreen() {
  const dashboard = useDashboard();
  const role = useViewer().data?.role;
  const data = dashboard.data;

  const header = (
    <PageHeader
      title="Dashboard"
      description={
        role &&
        (role === "admin"
          ? "Every rep's leads: what is new, what needs someone now, and what changed."
          : "Your leads: what is new, what needs you now, and what changed.")
      }
    />
  );

  if (dashboard.isError && !data) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState
          title="The dashboard did not load"
          description="Your leads are safe. Try again in a moment."
          onRetry={() => dashboard.refetch()}
          retrying={dashboard.isFetching}
        />
      </div>
    );
  }

  const loading = !data;
  const empty =
    data && data.needsYou.length === 0 && data.activity.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {header}

      <section
        aria-label="This week"
        // Two up below `wide`; an odd last tile takes the whole row, not half.
        className="grid grid-cols-2 gap-3 wide:auto-cols-fr wide:grid-flow-col max-wide:[&>:last-child:nth-child(odd)]:col-span-2"
      >
        <StatTile
          label="New leads this week"
          value={data?.newThisWeek ?? null}
          loading={loading}
          href={isLive("lead-list") ? LEADS_HREF : undefined}
        />
        <StatTile
          label="Suspects to review"
          value={data?.suspects ?? null}
          loading={loading}
          href={isLive("suspect-review-queue") ? REVIEW_QUEUE_HREF : undefined}
        />
        <StatTile
          label="Calls in the next 48 hours"
          value={data?.callsNext48h ?? null}
          loading={loading}
        />
        {/* Shown once their screens ship; nothing counts them yet, so they
            say "not measured" rather than 0. */}
        {isLive("deck-library") && (
          <StatTile
            label="Decks this week"
            value={null}
            loading={loading}
            href={DECKS_HREF}
          />
        )}
        {isLive("proposal-list") && (
          <StatTile
            label="Proposals out"
            value={null}
            loading={loading}
            href={PROPOSALS_HREF}
          />
        )}
      </section>

      {loading ? (
        <div className="grid gap-4 wide:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : empty ? (
        <EmptyState
          variant="empty"
          title="No leads yet"
          body="New form fills land here automatically."
        />
      ) : (
        <div className="grid items-start gap-4 wide:grid-cols-[minmax(0,1fr)_320px]">
          <PanelSection title="Needs you now">
            {data.needsYou.length === 0 ? (
              <p className="text-muted-foreground">
                Nothing needs you right now.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.needsYou.map((item) => {
                  const reason = REASONS[item.reason];
                  return (
                    <li key={`${item.reason}-${item.lead.id}`}>
                      <LeadRow
                        leadId={item.lead.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1"
                      >
                        <ListRowName className="min-w-0 flex-1">
                          {item.lead.name}
                        </ListRowName>
                        <Badge variant={reason.tone}>{reason.label}</Badge>
                        {item.time && (
                          <span className="w-full text-meta text-muted-foreground tabular-nums">
                            {reason.when} <LocalTime value={item.time} />
                          </span>
                        )}
                      </LeadRow>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelSection>

          <PanelSection title="Recent activity">
            {data.activity.length === 0 ? (
              <p className="text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-border">
                {data.activity.map((activity) => (
                  <li key={activity.id}>
                    <LeadRow
                      leadId={activity.lead.id}
                      className="flex flex-col gap-0.5"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <ListRowName className="min-w-0">
                          {activity.lead.name}
                        </ListRowName>
                        <LocalTime
                          value={activity.time}
                          className="shrink-0 text-meta text-muted-foreground tabular-nums"
                        />
                      </span>
                      <span className="text-pretty wrap-break-word">
                        {activity.type}
                      </span>
                      {activity.detail && (
                        <span className="text-meta text-pretty wrap-break-word text-muted-foreground">
                          {activity.detail}
                        </span>
                      )}
                      <span className="text-meta text-muted-foreground">
                        {activity.actor.name}
                      </span>
                    </LeadRow>
                  </li>
                ))}
              </ol>
            )}
          </PanelSection>
        </div>
      )}
    </div>
  );
}
