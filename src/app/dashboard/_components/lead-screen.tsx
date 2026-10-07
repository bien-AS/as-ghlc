"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { HintLine } from "@/components/ui/hint-line";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { LocalTime } from "@/components/ui/local-time";
import { PanelSection } from "@/components/ui/panel-section";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { VerdictBox } from "@/components/ui/verdict-box";
import {
  useLead,
  useMarkLost,
  useMarkSpam,
  useSetQualification,
} from "@/hooks/use-leads";
import { usePipelineHref } from "@/hooks/use-pipeline-href";
import { ApiError } from "@/lib/api/client";
import {
  ACTION_LABEL,
  BOOKING_KIND_LABEL,
  BOOKING_STATE_LABEL,
  EXIT_LABEL,
  type LeadAction,
  nextStep,
  PROPOSAL_LABEL,
  STAGE_LABEL,
  STATUS_META,
  VERDICT_META,
} from "@/lib/leads/rules";

import { deckHref, proposalHref, suspectHref } from "../navigation";

/** How many timeline entries show before "Show earlier" (spec 06, "Long content"). */
const TIMELINE_FIRST = 20;

/** The actions that only lead somewhere else. Check invoice draft has nowhere to go yet. */
const DESTINATION: Partial<Record<LeadAction, (leadId: string) => string>> = {
  review: suspectHref,
  open_deck: deckHref,
  start_proposal: proposalHref,
  finish_proposal: proposalHref,
};

type Write = "qualify" | "not_qualify" | "lost" | "spam";
type Handlers = { onSuccess: () => void; onError: (error: Error) => void };
const DONE: Record<Write, string> = {
  qualify: "Marked qualified",
  not_qualify: "Marked not qualified",
  lost: "Marked lost",
  spam: "Marked as spam",
};

const Missing = () => (
  <>
    <span aria-hidden="true">–</span>
    <span className="sr-only">Not given</span>
  </>
);

const linkClass =
  "font-semibold break-all text-brand-text underline-offset-4 hover:underline";

/**
 * Lead detail (spec 06): everything about one lead, and the one thing to do
 * next. Which actions show, and the hint under them, come from `nextStep`,
 * the same rule the server uses to refuse an action the lead does not allow.
 */
export function LeadScreen({
  leadId,
  missing = false,
}: {
  leadId: string;
  /** The server already knows this lead does not exist. */
  missing?: boolean;
}) {
  const pipelineHref = usePipelineHref();
  const lead = useLead(missing ? undefined : leadId);
  const qualification = useSetQualification();
  const lost = useMarkLost();
  const spam = useMarkSpam();
  const [reason, setReason] = useState("");
  // The last write, kept so a failed one can be retried as it was.
  const [last, setLast] = useState<{ write: Write; run: () => void }>();
  const [failure, setFailure] = useState<"failed" | "changed">();
  const [showAll, setShowAll] = useState(false);

  const back = (
    <Link
      href={pipelineHref}
      className="inline-flex items-center gap-1 self-start rounded-md font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      Pipeline
    </Link>
  );
  const backButton = (
    <LinkButton href={pipelineHref}>Back to the Pipeline</LinkButton>
  );

  const notFound =
    missing || (lead.error instanceof ApiError && lead.error.status === 404);
  if (notFound) {
    return (
      <EmptyState
        title="This lead does not exist"
        description="It may have been removed, or the link may be wrong."
        action={backButton}
      />
    );
  }
  if (lead.isPending) return <LeadSkeleton />;
  if (lead.isError && !lead.data) {
    return (
      <ErrorState
        title="This lead could not be loaded"
        description="Nothing was changed. Check your connection and try again."
        retrying={lead.isFetching}
        onRetry={() => lead.refetch()}
        action={backButton}
      />
    );
  }

  const data = lead.data;
  const step = nextStep(data);
  const pending =
    qualification.isPending || lost.isPending || spam.isPending
      ? last?.write
      : undefined;
  const busy = pending !== undefined;

  /** Runs a write and reports how it went. Nothing is assumed before the server answers. */
  const run = (write: Write, start: (handlers: Handlers) => void) => {
    const attempt = () => {
      setFailure(undefined);
      start({
        onSuccess: () => {
          toast.add({ title: `${DONE[write]}: ${data.name}`, type: "success" });
        },
        onError: (error) => {
          // Refused because the lead changed elsewhere: the hook reloads it.
          setFailure(
            error instanceof ApiError && error.status === 409
              ? "changed"
              : "failed",
          );
        },
      });
    };
    setLast({ write, run: attempt });
    attempt();
  };
  const qualify = (decision: "qualified" | "not_qualified") =>
    run(decision === "qualified" ? "qualify" : "not_qualify", (handlers) =>
      qualification.mutate({ leadId, input: { decision } }, handlers),
    );

  const mainButton = () => {
    if (!step.main) return null;
    const label = ACTION_LABEL[step.main];
    const to = DESTINATION[step.main]?.(data.id);
    if (to) {
      return (
        <LinkButton
          variant="primary"
          href={to}
          aria-disabled={busy || undefined}
        >
          {label}
        </LinkButton>
      );
    }
    if (step.main === "qualify") {
      return (
        <Button
          variant="primary"
          loading={pending === "qualify"}
          disabled={busy}
          onClick={() => qualify("qualified")}
        >
          {label}
        </Button>
      );
    }
    // Check invoice draft: shown, but there is nowhere to send the rep yet.
    return (
      <Button variant="primary" disabled>
        {label}
      </Button>
    );
  };

  const nextCall = data.nextBooking;
  const activities = showAll
    ? data.activities
    : data.activities.slice(0, TIMELINE_FIRST);
  const record = data.verdictRecord;
  const verdict = VERDICT_META[data.verdict];

  return (
    <>
      {back}

      <header className="flex flex-col gap-2">
        <h1
          tabIndex={-1}
          className="text-2xl leading-tight wrap-break-word outline-none"
        >
          {data.exit ? (
            <>
              <s className="text-muted-foreground">{data.name}</s>
              <span className="sr-only"> (left the pipeline)</span>
            </>
          ) : (
            data.name
          )}
        </h1>
        {data.company && (
          <p className="wrap-break-word text-muted-foreground">
            {data.company}
          </p>
        )}
        <ul
          aria-label="Where this lead stands"
          className="flex flex-wrap gap-2"
        >
          <li>
            {data.exit ? (
              <Badge variant="crit">Exit: {EXIT_LABEL[data.exit]}</Badge>
            ) : (
              <Badge>Stage: {STAGE_LABEL[data.stage]}</Badge>
            )}
          </li>
          <li>
            <Badge variant={STATUS_META[data.status].tone}>
              {STATUS_META[data.status].label}
            </Badge>
          </li>
          <li>
            <Badge variant={verdict.tone}>Verdict: {verdict.label}</Badge>
          </li>
          <li>
            <Badge>Owner: {data.owner.name}</Badge>
          </li>
          {data.proposal && (
            <li>
              <Badge>Proposal: {PROPOSAL_LABEL[data.proposal.status]}</Badge>
            </li>
          )}
        </ul>
      </header>

      <section aria-label="Actions" className="flex flex-col gap-3">
        {(step.main || step.canMarkLost || step.canMarkSpam) && (
          <div className="flex flex-wrap items-center gap-3">
            {mainButton()}
            {step.secondary === "not_qualify" && (
              <ConfirmDialog
                trigger={
                  <Button loading={pending === "not_qualify"} disabled={busy}>
                    {ACTION_LABEL.not_qualify}
                  </Button>
                }
                title={`Mark ${data.name} not qualified?`}
                description="The lead leaves the pipeline as Lead Lost, with the status Not a fit. This cannot be undone."
                confirmLabel="Mark not qualified"
                onConfirm={() => qualify("not_qualified")}
              />
            )}
            {/* The two standing actions sit apart from the main one. */}
            <div className="flex flex-wrap gap-3 nav:ml-auto">
              {step.canMarkLost && (
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="danger"
                      loading={pending === "lost"}
                      disabled={busy}
                    >
                      Mark lost
                    </Button>
                  }
                  title={`Mark ${data.name} lost?`}
                  description="The lead leaves the pipeline as Lead Lost. This cannot be undone."
                  confirmLabel="Mark lost"
                  onConfirm={() => {
                    const input = { reason: reason.trim() || undefined };
                    setReason("");
                    run("lost", (handlers) =>
                      lost.mutate({ leadId, input }, handlers),
                    );
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="lost-reason">Reason (optional)</Label>
                    <Textarea
                      id="lost-reason"
                      value={reason}
                      maxLength={500}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </div>
                </ConfirmDialog>
              )}
              {step.canMarkSpam && (
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="danger"
                      loading={pending === "spam"}
                      disabled={busy}
                    >
                      Mark spam
                    </Button>
                  }
                  title={`Mark ${data.name} as spam?`}
                  description="The lead leaves the pipeline as Spam and any upcoming call is cancelled. This cannot be undone."
                  confirmLabel="Mark as spam"
                  onConfirm={() =>
                    run("spam", (handlers) =>
                      spam.mutate({ leadId, input: {} }, handlers),
                    )
                  }
                />
              )}
            </div>
          </div>
        )}

        {failure && !busy && (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {failure === "changed" ? (
                "This lead had changed, so that action no longer applies. You are now looking at the latest version."
              ) : (
                <>
                  That did not go through. The lead is unchanged.
                  <Button size="sm" onClick={() => last?.run()}>
                    Try again
                  </Button>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <HintLine>
          {step.hint}
          {data.exit && (
            <>
              {" "}
              It left on <LocalTime
                value={data.updatedAt}
                format="date"
              />. {data.activities[0]?.detail}
            </>
          )}
        </HintLine>
      </section>

      <div className="grid gap-4 nav:grid-cols-[minmax(0,1fr)_300px] nav:grid-rows-[auto_auto_1fr] nav:[grid-template-areas:'details_aside'_'answers_aside'_'timeline_aside'] wide:grid-cols-[270px_minmax(0,1fr)_300px] wide:grid-rows-[auto_1fr] wide:[grid-template-areas:'details_answers_aside'_'details_timeline_aside']">
        <PanelSection
          title="Details"
          className="nav:self-start nav:[grid-area:details]"
        >
          <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 [&_dt]:text-muted-foreground">
            <dt>Email</dt>
            <dd>
              {data.email ? (
                <a href={`mailto:${data.email}`} className={linkClass}>
                  {data.email}
                </a>
              ) : (
                <Missing />
              )}
            </dd>
            <dt>Phone</dt>
            <dd>
              {data.phone ? (
                <a href={`tel:${data.phone}`} className={linkClass}>
                  {data.phone}
                </a>
              ) : (
                <Missing />
              )}
            </dd>
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
                <Missing />
              )}
            </dd>
            <dt>Source</dt>
            <dd>{data.source}</dd>
            <dt>Budget</dt>
            <dd>{data.budget ?? <Missing />}</dd>
            <dt>Next call</dt>
            <dd>
              {nextCall ? (
                <>
                  {BOOKING_KIND_LABEL[nextCall.kind]},{" "}
                  <LocalTime value={nextCall.time} /> (
                  {BOOKING_STATE_LABEL[nextCall.state]})
                </>
              ) : (
                "No call booked"
              )}
            </dd>
            <dt>Deck</dt>
            <dd>{data.deck ? data.deck.templateName : "Not generated yet"}</dd>
            <dt>Proposal</dt>
            <dd>
              {data.proposal
                ? PROPOSAL_LABEL[data.proposal.status]
                : "Not started"}
            </dd>
            <dt>Invoice</dt>
            <dd className="first-letter:uppercase">
              {data.invoice?.status ?? "No invoice yet"}
            </dd>
          </dl>
          {data.bookings.length > 0 && (
            <>
              <h3 className="mt-1 font-sans text-sm font-semibold tracking-normal">
                Calls
              </h3>
              <ul className="flex flex-col gap-1.5">
                {data.bookings.map((booking) => (
                  <li key={`${booking.kind}-${booking.time}`}>
                    {BOOKING_KIND_LABEL[booking.kind]},{" "}
                    <LocalTime value={booking.time} />{" "}
                    <span className="text-muted-foreground">
                      ({BOOKING_STATE_LABEL[booking.state]})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </PanelSection>

        <PanelSection title="Form answers" className="nav:[grid-area:answers]">
          {data.formAnswers.length === 0 ? (
            <p className="text-muted-foreground">
              No form answers on this lead.
            </p>
          ) : (
            <dl className="flex flex-col gap-3">
              {data.formAnswers.map(({ question, answer }) => (
                <div key={question} className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">{question}</dt>
                  <dd className="max-w-[70ch] text-pretty wrap-break-word">
                    {answer}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </PanelSection>

        <div className="flex flex-col gap-4 nav:[grid-area:aside]">
          {record ? (
            <VerdictBox
              tone={verdict.tone === "ok" ? "ok" : "crit"}
              word={verdict.label}
              summary={record.summary}
              reasons={record.reasons}
            >
              {!record.summary && record.reasons.length === 0 && (
                <p>The AI gave no reasons.</p>
              )}
              {record.reviewOutcome && record.reviewedAt && (
                <p className="border-t border-current/15 pt-3">
                  The AI was unsure about this lead.{" "}
                  <strong className="font-semibold">{record.reviewedBy}</strong>{" "}
                  {record.reviewOutcome === "cleared"
                    ? "cleared it as valid"
                    : "marked it as spam"}{" "}
                  on <LocalTime value={record.reviewedAt} />.
                </p>
              )}
            </VerdictBox>
          ) : (
            <VerdictBox
              tone="warn"
              word={verdict.label}
              summary="The AI is still checking this lead."
            />
          )}

          <PanelSection title="Deck">
            <p>{data.deck ? data.deck.templateName : "Not generated yet"}</p>
            <p className="text-muted-foreground">
              Not available yet: viewing and downloading a deck.
            </p>
          </PanelSection>
          <PanelSection title="Proposal">
            <p>
              {data.proposal
                ? PROPOSAL_LABEL[data.proposal.status]
                : "Not started"}
            </p>
            <p className="text-muted-foreground">
              Not available yet: building and sending a proposal.
            </p>
          </PanelSection>
          <PanelSection title="Invoice">
            <p className="first-letter:uppercase">
              {data.invoice?.status ?? "No invoice yet"}
            </p>
            <p className="text-muted-foreground">
              Not available yet: opening an invoice draft.
            </p>
          </PanelSection>
        </div>

        <PanelSection
          title="Activity"
          className="nav:self-start nav:[grid-area:timeline]"
        >
          {data.activities.length === 0 ? (
            <p className="text-muted-foreground">
              Nothing has happened on this lead yet.
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold">{activity.type}</span>
                    <LocalTime
                      value={activity.time}
                      className="text-muted-foreground"
                    />
                  </span>
                  <span className="text-pretty wrap-break-word">
                    {activity.detail}
                  </span>
                  <span className="text-muted-foreground">
                    {activity.actor.name}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {!showAll && data.activities.length > TIMELINE_FIRST && (
            <Button className="self-start" onClick={() => setShowAll(true)}>
              Show earlier ({data.activities.length - TIMELINE_FIRST})
            </Button>
          )}
        </PanelSection>
      </div>
    </>
  );
}

function LeadSkeleton() {
  return (
    <output aria-label="Loading lead" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-4 nav:grid-cols-[minmax(0,1fr)_300px] wide:grid-cols-[270px_minmax(0,1fr)_300px]">
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-40 rounded-box" />
      </div>
    </output>
  );
}
