"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { LinkButton } from "@/components/ui/link-button";
import { LocalTime } from "@/components/ui/local-time";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PanelSection } from "@/components/ui/panel-section";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import {
  SeamList,
  WritePreview,
  writeOutcome,
} from "@/components/ui/sync-seam";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { VerdictBox } from "@/components/ui/verdict-box";
import {
  useAssignRep,
  useChangeStatus,
  useLead,
  useMarkSpam,
  usePipelineSummary,
  useSetQualification,
  useStatusDefs,
} from "@/hooks/use-leads";
import { usePipelineHref } from "@/hooks/use-pipeline-href";
import { useCan } from "@/hooks/use-viewer";
import { ApiError } from "@/lib/api/client";
import { isLive } from "@/lib/flags";
import {
  ACTION_LABEL,
  BOOKING_KIND_LABEL,
  BOOKING_STATE_LABEL,
  EXIT_LABEL,
  type LeadAction,
  nextStep,
  PROPOSAL_LABEL,
  STAGE_LABEL,
  statusMeta,
  VERDICT_META,
} from "@/lib/leads/rules";
import type { LeadDetail, SyncEntry } from "@/lib/leads/schemas";

import { deckHref, proposalHref, suspectHref } from "../navigation";
import { ResearchTab } from "./lead-research";

const SYNC_LOG_HREF = "/admin/sync-log";
/** How many timeline entries show before "Show earlier". */
const TIMELINE_FIRST = 20;

/**
 * Where a next step leads, and the registry screen that must be live for the
 * link to be drawn (spec 01, phase flags). Qualify happens here instead.
 */
const DESTINATION: Partial<
  Record<LeadAction, { screen: string; href: (leadId: string) => string }>
> = {
  review: { screen: "suspect-review-queue", href: suspectHref },
  open_deck: { screen: "deck-detail", href: deckHref },
  start_proposal: { screen: "proposal-detail", href: proposalHref },
  finish_proposal: { screen: "proposal-detail", href: proposalHref },
  open_proposal: { screen: "proposal-detail", href: proposalHref },
};

const TABS = [
  "overview",
  "research",
  "decks",
  "proposals",
  "meetings",
  "timeline",
] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = {
  overview: "Overview",
  research: "Research",
  decks: "Decks",
  proposals: "Proposals",
  meetings: "Meetings",
  timeline: "Timeline",
};

const Missing = () => (
  <>
    <span aria-hidden="true">-</span>
    <span className="sr-only">Not given</span>
  </>
);

const linkClass =
  "rounded-sm font-semibold wrap-anywhere text-brand-text underline-offset-4 outline-none hover:underline focus-visible:shadow-focus";

/** The newest write of a type, as the write route returned the lead. */
const latestWrite = (lead: LeadDetail, type: SyncEntry["writeType"]) =>
  lead.syncLog.find((entry) => entry.writeType === type);

/** A refused or failed write, in words. */
function failed(error: Error) {
  toast.add(
    error instanceof ApiError && error.status === 409
      ? {
          title: "That no longer applies",
          description:
            "This lead had changed. You are now looking at the latest version.",
          type: "error",
        }
      : {
          title: "That did not go through",
          description: "The lead is unchanged and nothing was sent. Try again.",
          type: "error",
        },
  );
}

/**
 * Lead detail (spec 07, registry `lead-detail`): the header, six tabs, and a
 * rail with the next step and the seam (every write to the CRM for this
 * lead). Each action that writes to the CRM names the write in its modal
 * before it happens, and says afterwards what became of it.
 */
export function LeadScreen({
  leadId,
  missing = false,
}: {
  leadId: string;
  /** The server already knows this lead does not exist. */
  missing?: boolean;
}) {
  const backHref = usePipelineHref();
  const lead = useLead(missing ? undefined : leadId);
  const isAdmin = useCan("see_all_leads");

  const back = (
    <Link
      href={backHref}
      className="inline-flex items-center gap-1 self-start rounded-md font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-focus"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      Leads
    </Link>
  );
  const backButton = <LinkButton href={backHref}>Back to leads</LinkButton>;

  const notFound =
    missing || (lead.error instanceof ApiError && lead.error.status === 404);
  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title="This lead does not exist"
        body="It may have been removed, or the link may be wrong."
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
  return (
    <>
      {back}
      <LeadHeader lead={data} />
      <Actions lead={data} isAdmin={isAdmin} />

      <div className="grid gap-4 nav:grid-cols-[minmax(0,1fr)_300px] nav:items-start">
        <aside
          aria-label="Next step and writes to the CRM"
          className="flex flex-col gap-4 nav:order-2"
        >
          <NextStepPanel lead={data} />
          <PanelSection
            title="Writes to the CRM"
            actions={
              isAdmin &&
              isLive("sync-log") && (
                <Link href={SYNC_LOG_HREF} className={linkClass}>
                  Sync log
                </Link>
              )
            }
          >
            <SeamList entries={data.syncLog} />
          </PanelSection>
        </aside>
        <LeadTabs lead={data} />
      </div>
    </>
  );
}

function LeadHeader({ lead }: { lead: LeadDetail }) {
  const verdict = VERDICT_META[lead.verdict];
  const status = statusMeta(lead.status);
  return (
    <header className="flex flex-col gap-2">
      <h1
        tabIndex={-1}
        className="text-[24px] leading-tight wrap-break-word outline-none"
      >
        {lead.exit ? (
          <>
            <s className="text-muted-foreground">{lead.name}</s>
            <span className="sr-only"> (left the pipeline)</span>
          </>
        ) : (
          lead.name
        )}
      </h1>
      {lead.company && (
        <p className="wrap-break-word text-muted-foreground">{lead.company}</p>
      )}
      <ul aria-label="Where this lead stands" className="flex flex-wrap gap-2">
        <li>
          <Badge variant={verdict.tone}>Verdict: {verdict.label}</Badge>
        </li>
        <li>
          {lead.exit ? (
            <Badge variant="crit">Left: {EXIT_LABEL[lead.exit]}</Badge>
          ) : (
            <Badge>
              Stage: {lead.stage ? STAGE_LABEL[lead.stage] : "Not synced yet"}
            </Badge>
          )}
        </li>
        <li className="max-w-full">
          {/* The longest statuses wrap on a phone instead of leaving the screen. */}
          <Badge
            variant={status.tone}
            className="h-auto max-w-full text-left whitespace-normal"
          >
            Lead Status: {status.label}
          </Badge>
        </li>
        <li>
          <Badge>Rep: {lead.owner?.name ?? "Unassigned"}</Badge>
        </li>
        {lead.archivedAt && (
          <li>
            <Badge variant="warn">Archived</Badge>
          </li>
        )}
      </ul>
    </header>
  );
}

/**
 * The actions this lead allows (nextStep, the rule the server also applies),
 * and the two admin-only ones. While one is in flight, none can be pressed.
 */
function Actions({ lead, isAdmin }: { lead: LeadDetail; isAdmin: boolean }) {
  const qualification = useSetQualification();
  const spam = useMarkSpam();
  const status = useChangeStatus();
  const assign = useAssignRep();
  const busy =
    qualification.isPending ||
    spam.isPending ||
    status.isPending ||
    assign.isPending;
  const step = nextStep(lead);
  const live = !lead.exit && !lead.archivedAt;

  const qualify = (decision: "qualified" | "not_qualified") =>
    qualification.mutate(
      { leadId: lead.id, input: { decision } },
      {
        onSuccess: (updated) => {
          const outcome = writeOutcome(
            latestWrite(updated, "w3_qualification"),
          );
          toast.add({
            title:
              decision === "qualified"
                ? `Marked ${lead.name} qualified`
                : `Marked ${lead.name} not qualified`,
            description: outcome.description,
            type: outcome.failed ? "error" : "success",
          });
        },
        onError: failed,
      },
    );

  const qualifyPreview = (decision: "qualified" | "not_qualified") => (
    <WritePreview>
      <span>
        In the CRM: sets Qualification Decision to{" "}
        <strong className="font-semibold text-ink">
          {decision === "qualified" ? "Qualified" : "Not qualified"}
        </strong>{" "}
        on the opportunity, and moves it to the{" "}
        <strong className="font-semibold text-ink">
          {decision === "qualified" ? "Qualified" : "Lead Lost"}
        </strong>{" "}
        stage.
      </span>
      <span>The CRM then sends the follow-up email.</span>
    </WritePreview>
  );

  const canAct = live && (step.canQualify || step.canMarkSpam || isAdmin);
  if (!canAct) return null;

  return (
    <section aria-label="Actions" className="flex flex-wrap items-center gap-3">
      {step.canQualify && (
        <>
          <ConfirmDialog
            tone="neutral"
            trigger={
              <Button
                variant="primary"
                loading={qualification.isPending}
                disabled={busy}
              >
                {ACTION_LABEL.qualify}
              </Button>
            }
            title={`Mark ${lead.name} qualified?`}
            description="Records the discovery call's outcome."
            confirmLabel="Mark qualified"
            onConfirm={() => qualify("qualified")}
          >
            {qualifyPreview("qualified")}
          </ConfirmDialog>
          <ConfirmDialog
            trigger={
              <Button disabled={busy}>{ACTION_LABEL.not_qualify}</Button>
            }
            title={`Mark ${lead.name} not qualified?`}
            description="The lead leaves the pipeline as Lead Lost. This cannot be undone here."
            confirmLabel="Mark not qualified"
            onConfirm={() => qualify("not_qualified")}
          >
            {qualifyPreview("not_qualified")}
          </ConfirmDialog>
        </>
      )}

      <div className="flex flex-wrap gap-3 nav:ml-auto">
        {isAdmin && (
          <>
            <StatusDialog
              key={lead.status?.value}
              lead={lead}
              mutation={status}
              busy={busy}
            />
            <AssignDialog
              key={lead.owner?.id}
              lead={lead}
              mutation={assign}
              busy={busy}
            />
          </>
        )}
        {step.canMarkSpam && (
          <ConfirmDialog
            trigger={
              <Button variant="danger" loading={spam.isPending} disabled={busy}>
                Mark as spam
              </Button>
            }
            title={`Mark ${lead.name} as spam?`}
            description="The lead leaves the pipeline as Spam. This cannot be undone here."
            confirmLabel="Mark as spam"
            onConfirm={() =>
              spam.mutate(
                { leadId: lead.id, input: {} },
                {
                  onSuccess: (updated) => {
                    const outcome = writeOutcome(
                      latestWrite(updated, "w4_mark_spam"),
                    );
                    toast.add({
                      title: `Marked ${lead.name} as spam`,
                      description: outcome.description,
                      type: outcome.failed ? "error" : "success",
                    });
                  },
                  onError: failed,
                },
              )
            }
          >
            <WritePreview>
              <span>
                In the CRM: sets Validation Status to{" "}
                <strong className="font-semibold text-ink">Spam</strong> on the
                contact.
              </span>
              <span>
                The CRM then cancels any booking, sends its note and removes the
                record.
              </span>
            </WritePreview>
          </ConfirmDialog>
        )}
      </div>
    </section>
  );
}

/** Change status (admin, spec 07 question 2): app only; the next sync may overwrite it. */
function StatusDialog({
  lead,
  mutation,
  busy,
}: {
  lead: LeadDetail;
  mutation: ReturnType<typeof useChangeStatus>;
  busy: boolean;
}) {
  const [value, setValue] = useState(lead.status?.value ?? "");
  const id = useId();
  // GHL's picklist, in its order, under its groups.
  const groups = Object.entries(
    Object.groupBy(useStatusDefs().data ?? [], (status) => status.group),
  );
  return (
    <ConfirmDialog
      tone="neutral"
      trigger={
        <Button loading={mutation.isPending} disabled={busy}>
          Change status
        </Button>
      }
      title={`Change ${lead.name}'s Lead Status?`}
      description="Sets the Lead Status shown in this app."
      confirmLabel="Change status"
      onConfirm={() => {
        if (!value || value === lead.status?.value) return;
        mutation.mutate(
          { leadId: lead.id, input: { status: value } },
          {
            onSuccess: () =>
              toast.add({
                title: `Lead Status is now ${value}`,
                description:
                  "Changed in this app only. Nothing was written to the CRM.",
                type: "success",
              }),
            onError: failed,
          },
        );
      }}
    >
      <Field>
        <FieldLabel htmlFor={id}>Lead Status</FieldLabel>
        <NativeSelect
          id={id}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-full"
        >
          {!lead.status && (
            <NativeSelectOption value="" disabled>
              Choose a status
            </NativeSelectOption>
          )}
          {groups.map(([group, statuses = []]) => (
            <NativeSelectOptGroup key={group} label={group}>
              {statuses.map(({ value: status }) => (
                <NativeSelectOption key={status} value={status}>
                  {status}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
      </Field>
      <WritePreview>
        <span>
          Nothing in the CRM. The status changes in this app only, and the CRM's
          own workflows may set it again at the next sync.
        </span>
      </WritePreview>
    </ConfirmDialog>
  );
}

/** Assign rep (admin): app only, until assignment rules exist. */
function AssignDialog({
  lead,
  mutation,
  busy,
}: {
  lead: LeadDetail;
  mutation: ReturnType<typeof useAssignRep>;
  busy: boolean;
}) {
  const owners = usePipelineSummary().data?.owners ?? [];
  const [value, setValue] = useState(lead.owner?.id ?? "");
  const id = useId();
  return (
    <ConfirmDialog
      tone="neutral"
      trigger={
        <Button loading={mutation.isPending} disabled={busy}>
          Assign rep
        </Button>
      }
      title={`Assign ${lead.name}?`}
      description="Chooses the rep who works this lead. They see it in their list."
      confirmLabel="Assign"
      onConfirm={() => {
        if (value === (lead.owner?.id ?? "")) return;
        const name =
          owners.find((owner) => owner.id === value)?.name ?? "nobody";
        mutation.mutate(
          { leadId: lead.id, input: { profileId: value || null } },
          {
            onSuccess: () =>
              toast.add({
                title: value
                  ? `Assigned ${lead.name} to ${name}`
                  : `${lead.name} is unassigned`,
                description:
                  "Changed in this app only. Nothing was written to the CRM.",
                type: "success",
              }),
            onError: failed,
          },
        );
      }}
    >
      <Field>
        <FieldLabel htmlFor={id}>Rep</FieldLabel>
        <NativeSelect
          id={id}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="">Unassigned</NativeSelectOption>
          {owners.map((owner) => (
            <NativeSelectOption key={owner.id} value={owner.id}>
              {owner.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <WritePreview>
        <span>
          Nothing in the CRM. Assignment happens in this app only until
          assignment rules exist.
        </span>
      </WritePreview>
    </ConfirmDialog>
  );
}

function NextStepPanel({ lead }: { lead: LeadDetail }) {
  const step = nextStep(lead);
  const destination = step.main ? DESTINATION[step.main] : undefined;
  return (
    <PanelSection title="Next step">
      <p className="text-pretty">
        {lead.archivedAt
          ? "This lead is archived. It stays in the app, out of the lead list."
          : step.hint}
      </p>
      {step.main &&
        destination &&
        isLive(destination.screen) &&
        !lead.archivedAt && (
          <LinkButton
            variant="primary"
            href={destination.href(lead.id)}
            className="self-start"
          >
            {ACTION_LABEL[step.main]}
          </LinkButton>
        )}
    </PanelSection>
  );
}

function LeadTabs({ lead }: { lead: LeadDetail }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("overview");
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as typeof tab)}
      className="min-w-0 gap-4"
    >
      {/* Scrolls sideways on narrow screens; the page itself never does. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1.5 nav:mx-0 nav:px-0">
        <TabsList variant="line" aria-label="About this lead" className="h-8">
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value} className="flex-none px-2">
              {TAB_LABEL[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="overview" className="flex flex-col gap-4">
        <Overview lead={lead} />
      </TabsContent>
      <TabsContent value="research" className="flex flex-col gap-4">
        <ResearchTab leadId={lead.id} />
      </TabsContent>
      <TabsContent value="decks">
        <DecksTab lead={lead} />
      </TabsContent>
      <TabsContent value="proposals">
        <ProposalsTab lead={lead} />
      </TabsContent>
      <TabsContent value="meetings">
        <MeetingsTab lead={lead} />
      </TabsContent>
      <TabsContent value="timeline">
        <TimelineTab lead={lead} />
      </TabsContent>
    </Tabs>
  );
}

function Overview({ lead }: { lead: LeadDetail }) {
  const record = lead.verdictRecord;
  const verdict = VERDICT_META[lead.verdict];
  const next = lead.nextBooking;
  return (
    <>
      {record ? (
        <VerdictBox
          tone={verdict.tone === "ok" ? "ok" : "crit"}
          word={verdict.label}
          summary={record.summary}
          reasons={record.reasons}
        >
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

      <PanelSection title="Details">
        <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2 [&_dt]:text-muted-foreground">
          <dt>Email</dt>
          <dd>
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className={linkClass}>
                {lead.email}
              </a>
            ) : (
              <Missing />
            )}
          </dd>
          <dt>Phone</dt>
          <dd>
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className={linkClass}>
                {lead.phone}
              </a>
            ) : (
              <Missing />
            )}
          </dd>
          <dt>Website</dt>
          <dd>
            {lead.website ? (
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                {lead.website.replace(/^https?:\/\//, "")}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <Missing />
            )}
          </dd>
          <dt>Source</dt>
          <dd>{lead.source ?? <Missing />}</dd>
          <dt>Next call</dt>
          <dd>
            {next ? (
              <>
                {BOOKING_KIND_LABEL[next.kind]}, <LocalTime value={next.time} />
              </>
            ) : (
              "None booked"
            )}
          </dd>
          <dt>Created</dt>
          <dd>
            <LocalTime value={lead.createdAt} format="date" />
          </dd>
          {lead.archivedAt && (
            <>
              <dt>Archived</dt>
              <dd>
                <LocalTime value={lead.archivedAt} format="date" />
                {lead.archivedReason && `: ${lead.archivedReason}`}
              </dd>
            </>
          )}
        </dl>
      </PanelSection>

      <PanelSection title="Form answers">
        {lead.formAnswers.length === 0 ? (
          <p className="text-muted-foreground">No form answers on this lead.</p>
        ) : (
          <dl className="flex flex-col gap-3">
            {lead.formAnswers.map(({ question, answer }) => (
              <div key={question} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{question}</dt>
                <dd className="max-w-[680px] text-pretty wrap-break-word">
                  {answer}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </PanelSection>
    </>
  );
}

function DecksTab({ lead }: { lead: LeadDetail }) {
  if (!lead.deck) {
    return (
      <EmptyState
        variant="empty"
        title="No decks yet"
        body="The discovery deck for this lead appears here once it is generated."
      />
    );
  }
  return (
    <PanelSection title="Deck">
      <p>{lead.deck.templateName} template</p>
      {isLive("deck-detail") && (
        <LinkButton href={deckHref(lead.id)} className="self-start">
          Open deck
        </LinkButton>
      )}
    </PanelSection>
  );
}

function ProposalsTab({ lead }: { lead: LeadDetail }) {
  if (!lead.proposal) {
    return (
      <EmptyState
        variant="empty"
        title="No proposals yet"
        body="A proposal for this lead appears here once it is started."
      />
    );
  }
  return (
    <PanelSection title="Proposal">
      <p>{PROPOSAL_LABEL[lead.proposal.status]}</p>
      {isLive("proposal-detail") && (
        <LinkButton href={proposalHref(lead.id)} className="self-start">
          Open proposal
        </LinkButton>
      )}
    </PanelSection>
  );
}

/** The calls booked in the CRM. Recordings and transcripts come with spec 11. */
function MeetingsTab({ lead }: { lead: LeadDetail }) {
  if (lead.bookings.length === 0) {
    return (
      <EmptyState
        variant="empty"
        title="No meetings yet"
        body="Discovery and proposal review calls appear here when they are booked."
      />
    );
  }
  return (
    <PanelSection title="Calls">
      <ul className="flex flex-col gap-2">
        {lead.bookings.map((booking) => (
          <li
            key={`${booking.kind}-${booking.time}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3"
          >
            <span className="font-semibold">
              {BOOKING_KIND_LABEL[booking.kind]}
            </span>
            <span className="text-muted-foreground">
              <LocalTime value={booking.time} />,{" "}
              {BOOKING_STATE_LABEL[booking.state]}
            </span>
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}

function TimelineTab({ lead }: { lead: LeadDetail }) {
  const [showAll, setShowAll] = useState(false);
  if (lead.activities.length === 0) {
    return (
      <EmptyState
        variant="empty"
        title="Nothing has happened yet"
        body="Stage, status and decision changes on this lead appear here."
      />
    );
  }
  const shown = showAll
    ? lead.activities
    : lead.activities.slice(0, TIMELINE_FIRST);
  return (
    <PanelSection title="Timeline">
      <ol className="flex flex-col divide-y divide-border">
        {shown.map((activity) => (
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
            {activity.detail && (
              <span className="text-pretty wrap-break-word">
                {activity.detail}
              </span>
            )}
            <span className="text-muted-foreground">{activity.actor.name}</span>
          </li>
        ))}
      </ol>
      {!showAll && lead.activities.length > TIMELINE_FIRST && (
        <Button className="self-start" onClick={() => setShowAll(true)}>
          Show earlier ({lead.activities.length - TIMELINE_FIRST})
        </Button>
      )}
    </PanelSection>
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
      <div className="grid gap-4 nav:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-40 rounded-panel" />
      </div>
    </output>
  );
}
