"use client";

import { formatDistanceStrict } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LinkButton } from "@/components/ui/link-button";
import { ListRow, ListRowName } from "@/components/ui/list-row";
import { LocalTime } from "@/components/ui/local-time";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import { toast } from "@/components/ui/toast";
import { VerdictBox } from "@/components/ui/verdict-box";
import {
  useLead,
  useLeads,
  usePrefetchLead,
  useReviewSuspect,
} from "@/hooks/use-leads";
import { useTimeZone } from "@/hooks/use-time-zone";
import { ApiError } from "@/lib/api/client";
import { nextStep } from "@/lib/leads/rules";
import {
  type LeadDetail,
  type LeadListItem,
  parseLeadFilters,
} from "@/lib/leads/schemas";

import {
  leadHref,
  PIPELINE_HREF,
  SUSPECTS_HREF,
  suspectHref,
} from "../navigation";

const DAY = 24 * 3_600_000;

const linkClass =
  "font-semibold break-all text-brand-text underline-offset-4 hover:underline";

/**
 * Suspect review (spec 07): the queue of leads the AI was unsure about, and
 * for the selected one, what the lead said beside why the AI is unsure, with
 * the two decisions. Nothing moves until the server confirms a decision.
 */
export function SuspectScreen({ leadId }: { leadId?: string }) {
  const router = useRouter();
  const filters = parseLeadFilters({ needs: "suspects" }, useTimeZone());
  const queue = useLeads(filters);
  const review = useReviewSuspect();
  // The clock is read once, when the screen opens, so the waiting times and
  // the "call soon" marks do not change under the rep while they read.
  const [now] = useState(() => Date.now());
  // The lead just decided: it stays out of view while the screen moves on.
  const [decided, setDecided] = useState<string>();
  const [clearedHere, setClearedHere] = useState(false);
  const [problem, setProblem] = useState<"failed" | "taken">();
  const [lastOutcome, setLastOutcome] = useState<"cleared" | "spam">();

  const suspects = queue.data?.pages.flatMap((page) => page.items) ?? [];
  const total = queue.data?.pages[0]?.total ?? 0;
  const selectedId = leadId ?? suspects[0]?.id;
  const lead = useLead(selectedId);
  const position = suspects.findIndex((suspect) => suspect.id === selectedId);
  const upNext = suspects[position + 1] ?? suspects[position - 1];
  usePrefetchLead(upNext?.id);

  // After a decision, focus lands on the next suspect's heading.
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current && lead.data?.id === selectedId) {
      moved.current = false;
      heading.current?.focus();
    }
  }, [lead.data?.id, selectedId]);

  const moveOn = (from: string) => {
    setDecided(from);
    moved.current = true;
    if (!upNext) setClearedHere(true);
    router.replace(upNext ? suspectHref(upNext.id) : SUSPECTS_HREF);
  };

  const decide = (target: LeadDetail, outcome: "cleared" | "spam") => {
    setProblem(undefined);
    setLastOutcome(outcome);
    review.mutate(
      { leadId: target.id, input: { outcome } },
      {
        onSuccess: () => {
          toast.add({
            title:
              outcome === "cleared"
                ? `Cleared as valid: ${target.name}`
                : `Marked as spam: ${target.name}`,
            type: "success",
          });
          moveOn(target.id);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            // Someone else decided first: drop it from the queue and move on.
            setProblem("taken");
            moveOn(target.id);
          } else {
            setProblem("failed");
          }
        },
      },
    );
  };

  const title = (
    <PageHeader
      title="Suspect review"
      description="Leads the AI was unsure about. Decide whether each one is genuine."
    />
  );

  if (queue.isPending) {
    return (
      <>
        {title}
        <ReviewSkeleton withQueue />
      </>
    );
  }
  if (queue.isError && !queue.data) {
    return (
      <>
        {title}
        <ErrorState
          title="The suspect queue could not be loaded"
          description="Nothing was changed. Check your connection and try again."
          retrying={queue.isFetching}
          onRetry={() => queue.refetch()}
        />
      </>
    );
  }

  const takenNote = problem === "taken" && (
    <Alert>
      <AlertDescription>
        Someone has already decided that lead, so it has left the queue.
      </AlertDescription>
    </Alert>
  );

  if (!selectedId) {
    return (
      <>
        {title}
        {takenNote}
        <EmptyState
          title="No suspects to review"
          description={
            clearedHere
              ? "The queue is clear. Leads the AI is unsure about appear here."
              : "Leads the AI is unsure about appear here."
          }
          action={
            <LinkButton href={PIPELINE_HREF}>Go to the Pipeline</LinkButton>
          }
        />
      </>
    );
  }

  const busy = review.isPending;
  const data = lead.data;
  const reviewable = data ? nextStep(data).canReview : false;

  return (
    <>
      {title}
      {takenNote}

      <div className="grid items-start gap-4 wide:grid-cols-[270px_minmax(0,1fr)]">
        {suspects.length > 0 && (
          <Queue
            suspects={suspects}
            total={total}
            selectedId={selectedId}
            now={now}
            locked={busy}
            onPick={(id) => router.push(suspectHref(id))}
            more={
              queue.hasNextPage && (
                <Button
                  size="sm"
                  loading={queue.isFetchingNextPage}
                  onClick={() => queue.fetchNextPage()}
                  className="m-3"
                >
                  Show more suspects
                </Button>
              )
            }
          />
        )}

        <section
          aria-label="Review"
          className="flex min-w-0 flex-col gap-4 wide:col-start-2"
        >
          {decided === selectedId || lead.isPending ? (
            <ReviewSkeleton />
          ) : lead.isError && !data ? (
            lead.error instanceof ApiError && lead.error.status === 404 ? (
              <EmptyState
                title="This lead does not exist"
                description="It may have been removed, or the link may be wrong."
              />
            ) : (
              <ErrorState
                title="This lead could not be loaded"
                description="The queue is unchanged. Try again."
                retrying={lead.isFetching}
                onRetry={() => lead.refetch()}
              />
            )
          ) : data && !reviewable ? (
            <EmptyState
              title="Nothing to decide on this lead"
              description="It has already been decided, or it is not a suspect."
              action={
                <LinkButton href={leadHref(data.id)}>
                  Open {data.name}
                </LinkButton>
              }
            />
          ) : data ? (
            <>
              <div className="flex flex-col gap-1">
                <h2
                  ref={heading}
                  tabIndex={-1}
                  className="text-xl leading-tight wrap-break-word outline-none"
                >
                  {data.name}
                </h2>
                {data.company && (
                  <p className="wrap-break-word text-muted-foreground">
                    {data.company}
                  </p>
                )}
              </div>

              {/* (Q4) The booking is kept until the rep decides. */}
              <p className="rounded-control bg-secondary px-3 py-2">
                {data.nextBooking ? (
                  <>
                    Call booked for <LocalTime value={data.nextBooking.time} />.
                    It stays booked until you decide.
                  </>
                ) : (
                  "No call booked."
                )}
              </p>

              <div className="grid items-start gap-4 nav:grid-cols-2">
                <section className="flex flex-col gap-3 rounded-panel bg-card p-4 ring-1 ring-border">
                  <h3 className="label-caps">What the lead said</h3>
                  <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 [&_dt]:text-muted-foreground">
                    <dt>Email</dt>
                    <dd className="break-all">{data.email ?? "Not given"}</dd>
                    <dt>Phone</dt>
                    <dd>{data.phone ?? "Not given"}</dd>
                    <dt>Website</dt>
                    <dd>
                      {data.website ? (
                        <a
                          href={data.website}
                          target="_blank"
                          rel="noreferrer"
                          className={linkClass}
                        >
                          {data.website.replace(/^https?:\/\//, "")}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        "Not given"
                      )}
                    </dd>
                    <dt>Source</dt>
                    <dd>{data.source}</dd>
                    <dt>Budget</dt>
                    <dd>{data.budget ?? "Not given"}</dd>
                  </dl>
                  {data.formAnswers.length === 0 ? (
                    <p className="border-t border-border pt-3 text-muted-foreground">
                      No form answers on this lead.
                    </p>
                  ) : (
                    <dl className="flex flex-col gap-3 border-t border-border pt-3">
                      {data.formAnswers.map(({ question, answer }) => (
                        <div key={question} className="flex flex-col gap-0.5">
                          <dt className="text-muted-foreground">{question}</dt>
                          <dd className="text-pretty wrap-break-word">
                            {answer}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>

                <section className="flex flex-col gap-3">
                  <h3 className="label-caps">Why the AI is unsure</h3>
                  <VerdictBox
                    tone="crit"
                    word="Suspect"
                    summary={data.verdictRecord?.summary}
                    reasons={data.verdictRecord?.reasons}
                  >
                    {!data.verdictRecord?.summary &&
                      !data.verdictRecord?.reasons.length && (
                        <p>The AI gave no reasons.</p>
                      )}
                  </VerdictBox>
                </section>
              </div>

              {problem === "failed" && !busy && (
                <Alert variant="destructive">
                  <AlertDescription className="flex flex-wrap items-center gap-3">
                    That decision was not recorded. The lead is still waiting.
                    {lastOutcome && (
                      <Button
                        size="sm"
                        onClick={() => decide(data, lastOutcome)}
                      >
                        Try again
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Stays in reach however long the answers and reasons are. */}
              <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background px-4 py-3 nav:mx-0 nav:px-0">
                <Button
                  variant="primary"
                  loading={busy && lastOutcome === "cleared"}
                  disabled={busy}
                  onClick={() => decide(data, "cleared")}
                >
                  Clear as valid
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="danger"
                      loading={busy && lastOutcome === "spam"}
                      disabled={busy}
                    >
                      Mark as spam
                    </Button>
                  }
                  title={`Mark ${data.name} as spam?`}
                  description={
                    data.nextBooking
                      ? "The lead leaves the pipeline as Spam and its booked call will be cancelled. This cannot be undone here."
                      : "The lead leaves the pipeline as Spam. This cannot be undone here."
                  }
                  confirmLabel="Mark as spam"
                  onConfirm={() => decide(data, "spam")}
                />
                <Link
                  href={leadHref(data.id)}
                  className="ml-auto font-semibold text-brand-text underline-offset-4 hover:underline"
                >
                  Open full lead
                </Link>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}

function Queue({
  suspects,
  total,
  selectedId,
  now,
  locked,
  onPick,
  more,
}: {
  suspects: LeadListItem[];
  total: number;
  selectedId: string;
  now: number;
  /** A decision is being saved: the queue cannot be changed until it settles. */
  locked: boolean;
  onPick: (leadId: string) => void;
  more: React.ReactNode;
}) {
  const heading = (
    <h2 id="suspect-queue" className="label-caps">
      Waiting <span className="tabular-nums">({total})</span>
    </h2>
  );
  return (
    <>
      {/* Below `wide`: a compact selector above the review. */}
      <div className="flex flex-col gap-2 wide:hidden">
        {heading}
        <NativeSelect
          aria-labelledby="suspect-queue"
          value={selectedId}
          disabled={locked}
          onChange={(event) => onPick(event.target.value)}
          className="w-full"
        >
          {/* A lead opened by link that is not in the queue still needs an entry. */}
          {!suspects.some((suspect) => suspect.id === selectedId) && (
            <NativeSelectOption value={selectedId}>
              Not in the queue
            </NativeSelectOption>
          )}
          {suspects.map((suspect) => (
            <NativeSelectOption key={suspect.id} value={suspect.id}>
              {suspect.name}
              {suspect.company ? `, ${suspect.company}` : ""}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <nav
        aria-label="Suspects waiting"
        className="hidden flex-col overflow-hidden rounded-panel bg-card ring-1 ring-border wide:flex"
      >
        <div className="border-b border-border px-4 py-2.5">
          <p className="label-caps">
            Waiting <span className="tabular-nums">({total})</span>
          </p>
        </div>
        <ul className="divide-y divide-border">
          {suspects.map((suspect) => {
            const call = suspect.nextBooking;
            const until = call
              ? new Date(call.time).getTime() - now
              : undefined;
            return (
              <li key={suspect.id}>
                <ListRow
                  href={suspectHref(suspect.id)}
                  selected={suspect.id === selectedId}
                  disabled={locked}
                  className="flex flex-col gap-0.5"
                >
                  <ListRowName>{suspect.name}</ListRowName>
                  <span className="truncate text-muted-foreground">
                    {suspect.company ?? "No company given"}
                  </span>
                  <span
                    className="text-muted-foreground"
                    // The server and the browser read the clock moments apart.
                    suppressHydrationWarning
                  >
                    Waiting{" "}
                    {formatDistanceStrict(new Date(suspect.createdAt), now)}
                  </span>
                  {call && (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        Call <LocalTime value={call.time} />
                      </span>
                      {until !== undefined && until > 0 && until < DAY && (
                        <Badge variant="warn" suppressHydrationWarning>
                          Call within a day
                        </Badge>
                      )}
                    </span>
                  )}
                </ListRow>
              </li>
            );
          })}
        </ul>
        {more}
      </nav>
    </>
  );
}

function ReviewSkeleton({ withQueue = false }: { withQueue?: boolean }) {
  const panel = (
    <output aria-label="Loading suspect" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-4 nav:grid-cols-2">
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-48 rounded-box" />
      </div>
    </output>
  );
  if (!withQueue) return panel;
  return (
    <div className="grid items-start gap-4 wide:grid-cols-[270px_minmax(0,1fr)]">
      <div className="hidden flex-col gap-2 wide:flex">
        {["a", "b", "c", "d"].map((row) => (
          <Skeleton key={row} className="h-16 w-full" />
        ))}
      </div>
      {panel}
    </div>
  );
}
