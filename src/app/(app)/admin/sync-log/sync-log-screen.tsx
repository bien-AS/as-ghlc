"use client";

import {
  type AuditState,
  type Column,
  DataTable,
  StatusPill,
} from "@vantage/design-system";
import Link from "next/link";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { JsonBlock } from "@/components/ui/json-block";
import { LinkButton } from "@/components/ui/link-button";
import { LocalTime } from "@/components/ui/local-time";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
} from "@/components/ui/state-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import {
  useRetryWrite,
  useSyncLog,
  useWebhookEvents,
} from "@/hooks/use-sync-log";
import { ApiError } from "@/lib/api/client";
import { isLive } from "@/lib/flags";
import type { SyncLogFilters } from "@/lib/queries/sync-log";
import type { SyncLogEntry, WebhookEventEntry } from "@/lib/sync-log/schemas";
import { cn } from "@/lib/utils";

import { DASHBOARD_HREF, leadHref } from "../../navigation";

/*
 * The GHL sync log (spec 06, "The sync log screen"; registry `sync-log`):
 * every write the app made to GHL, and every webhook GHL sent it. Admin only;
 * the server refuses a rep whatever this screen shows.
 */

type WriteType = SyncLogEntry["writeType"];
type WriteResult = SyncLogEntry["result"];

/**
 * Each write in words (spec 06, "Writes out"): what it changes in GHL, what GHL
 * then does, and what sending it twice can do.
 */
const WRITES: Record<
  WriteType,
  { label: string; sets: string; after?: string; twice?: string }
> = {
  w1_verdict: {
    label: "W1 Validation verdict",
    sets: "Validation Status and Validation Summary on the contact",
    after:
      "GHL then releases the lead into its sequence, or removes it if the verdict is spam.",
  },
  w2_deck_link: {
    label: "W2 Deck link",
    sets: "DS Deck Link on the contact",
  },
  w3_qualification: {
    label: "W3 Qualification",
    sets: "Qualification Decision on the opportunity, and its stage (Qualified or Lead Lost)",
    after: "GHL then sends the follow-up email.",
    twice:
      "If it did, retrying can send the follow-up email from Lee's workflow a second time.",
  },
  w4_mark_spam: {
    label: "W4 Mark spam",
    sets: "Validation Status to Spam on the contact",
    after:
      "GHL then cancels the booking, sends the note and removes the record.",
  },
  w5_proposal_sent: {
    label: "W5 Proposal sent",
    sets: "the proposal link on the contact, and the stage to Proposal Sent",
    after: "GHL then starts its proposal sequence.",
  },
  w6_proposal_signed: {
    label: "W6 Proposal signed",
    sets: "the opportunity's stage to Lead Won",
    after: "GHL then starts its won sequence.",
  },
};
const WRITE_TYPES = Object.keys(WRITES) as WriteType[];

/** Skipped is grey, never the red of a failure: nothing was sent. */
const RESULTS: Record<WriteResult, { state: AuditState; label: string }> = {
  succeeded: { state: "pass", label: "Succeeded" },
  failed: { state: "fail", label: "Failed" },
  skipped: { state: "unknown", label: "Skipped" },
  pending: { state: "unknown", label: "Pending" },
};
const RESULT_ORDER: WriteResult[] = [
  "failed",
  "skipped",
  "succeeded",
  "pending",
];

const WEBHOOK_TYPES: Record<string, string> = {
  contact_created: "Contact created",
  appointment_booked: "Appointment booked",
  appointment_cancelled: "Appointment cancelled",
  appointment_no_show: "No-show",
  stage_changed: "Stage changed",
  // Recorded when a request named no event type it knows (route.ts).
  unknown: "Unknown event",
};

/** A webhook's outcome as the job recorded it (ghl-webhook.ts, route.ts). */
function outcomeOf(outcome: string | null): {
  state: AuditState;
  label: string;
  detail?: string;
} {
  if (outcome === null) return { state: "unknown", label: "Waiting" };
  if (outcome.startsWith("failed")) {
    return {
      state: "fail",
      label: "Failed",
      detail: outcome.replace(/^failed:\s*/, ""),
    };
  }
  const known: Record<string, { state: AuditState; label: string }> = {
    created: { state: "pass", label: "Created" },
    updated: { state: "pass", label: "Updated" },
    unchanged: { state: "unknown", label: "No change" },
    skipped: { state: "unknown", label: "Skipped" },
    refused: { state: "fail", label: "Refused" },
    malformed: { state: "fail", label: "Malformed" },
  };
  return known[outcome] ?? { state: "unknown", label: outcome };
}

/** Why a write was skipped, in words. */
const skipReason = (entry: SyncLogEntry) =>
  entry.lastError === "writes disabled"
    ? "Writes to GHL are off. Nothing was sent."
    : entry.lastError;

const shortId = (id: string) => id.slice(0, 8);

/** The request a write sends, as "PUT /contacts/{id}". */
function requestLine(payload: unknown) {
  const plan = payload as { method?: unknown; path?: unknown } | null;
  return typeof plan?.method === "string" && typeof plan?.path === "string"
    ? `${plan.method} ${plan.path}`
    : undefined;
}

const forbidden = (error: unknown) =>
  error instanceof ApiError && error.code === "forbidden";

export function SyncLogScreen({
  notAllowed = false,
}: {
  /** The server already refused this viewer's role. */
  notAllowed?: boolean;
}) {
  const [tab, setTab] = useState("writes");
  const [writeType, setWriteType] = useState<WriteType | "">("");
  const [result, setResult] = useState<WriteResult | "">("");
  const filters: SyncLogFilters = {
    ...(writeType && { writeType }),
    ...(result && { result }),
  };
  const writes = useSyncLog(filters, { enabled: !notAllowed });

  const header = (
    <PageHeader
      title="Sync log"
      description="Every write the app made to GHL, newest first, and every webhook GHL sent it."
    />
  );

  if (notAllowed || forbidden(writes.error)) {
    return (
      <>
        {header}
        <ForbiddenState
          action={
            <LinkButton href={DASHBOARD_HREF}>Go to the dashboard</LinkButton>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line" aria-label="Sync log">
          <TabsTrigger value="writes">Writes</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks received</TabsTrigger>
        </TabsList>
        <TabsContent value="writes" className="flex flex-col gap-3">
          <WriteFilters
            writeType={writeType}
            result={result}
            onWriteType={setWriteType}
            onResult={setResult}
          />
          <WritesTab
            writes={writes}
            filtered={Boolean(writeType || result)}
            onClear={() => {
              setWriteType("");
              setResult("");
            }}
          />
        </TabsContent>
        <TabsContent value="webhooks" className="flex flex-col gap-3">
          <WebhooksTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function WriteFilters({
  writeType,
  result,
  onWriteType,
  onResult,
}: {
  writeType: WriteType | "";
  result: WriteResult | "";
  onWriteType: (value: WriteType | "") => void;
  onResult: (value: WriteResult | "") => void;
}) {
  const typeId = useId();
  const resultId = useId();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field className="w-[220px] max-w-full">
        <FieldLabel htmlFor={typeId}>Write type</FieldLabel>
        <NativeSelect
          id={typeId}
          value={writeType}
          onChange={(event) =>
            onWriteType(event.target.value as WriteType | "")
          }
          className="w-full"
        >
          <NativeSelectOption value="">Every write type</NativeSelectOption>
          {WRITE_TYPES.map((type) => (
            <NativeSelectOption key={type} value={type}>
              {WRITES[type].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field className="w-[160px] max-w-full">
        <FieldLabel htmlFor={resultId}>Result</FieldLabel>
        <NativeSelect
          id={resultId}
          value={result}
          onChange={(event) => onResult(event.target.value as WriteResult | "")}
          className="w-full"
        >
          <NativeSelectOption value="">Every result</NativeSelectOption>
          {RESULT_ORDER.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {RESULTS[value].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}

function WritesTab({
  writes,
  filtered,
  onClear,
}: {
  writes: ReturnType<typeof useSyncLog>;
  filtered: boolean;
  onClear: () => void;
}) {
  const [open, setOpen] = useState<SyncLogEntry | null>(null);

  if (writes.isError && !writes.data) {
    return (
      <ErrorState
        title="The sync log could not be loaded"
        description="Nothing was changed. Check your connection and try again."
        retrying={writes.isFetching}
        onRetry={() => writes.refetch()}
      />
    );
  }

  const rows = writes.data?.pages.flatMap((page) => page.items) ?? [];
  if (writes.data && rows.length === 0) {
    return filtered ? (
      <EmptyState
        variant="filtered"
        title="No writes match these filters"
        body="Other writes are hidden by the write type or result chosen above."
        action={
          <Button size="sm" onClick={onClear}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        variant="empty"
        title="No writes yet"
        body="Everything the app tells GHL lands here."
      />
    );
  }

  const columns: Column<SyncLogEntry>[] = [
    {
      id: "time",
      header: "Time",
      locked: true,
      value: (row) => row.createdAt,
      cell: (row) => (
        <LocalTime value={row.createdAt} className="tabular-nums" />
      ),
    },
    {
      id: "lead",
      header: "Lead",
      cell: (row) => <LeadRef leadId={row.leadId} />,
    },
    {
      id: "write",
      header: "Write",
      value: (row) => WRITES[row.writeType].label,
      cell: (row) => WRITES[row.writeType].label,
    },
    {
      id: "result",
      header: "Result",
      value: (row) => RESULTS[row.result].label,
      cell: (row) => <ResultCell entry={row} />,
    },
    {
      id: "attempts",
      header: "Attempts",
      numeric: true,
      value: (row) => row.attempts,
      cell: (row) => row.attempts,
    },
    {
      id: "key",
      header: "Idempotency key",
      value: (row) => row.idempotencyKey,
      cell: (row) => (
        <span className="block max-w-[280px] font-mono text-meta wrap-anywhere text-ink-2">
          {row.idempotencyKey}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      locked: true,
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            aria-label={`Payload of ${WRITES[row.writeType].label}, ${row.idempotencyKey}`}
            onClick={() => setOpen(row)}
          >
            Payload
          </Button>
          {row.result === "failed" && <RetryButton entry={row} />}
        </div>
      ),
    },
  ];

  return (
    <>
      <div aria-busy={writes.isFetching || undefined}>
        <DataTable
          caption="GHL writes, newest first"
          rows={rows}
          columns={columns}
          rowId={(row) => row.id}
          loading={writes.isPending}
          searchPlaceholder="Search loaded writes"
          densityKey="sync-log"
          defaultDensity="compact"
        />
      </div>
      <LoadOlder query={writes} label="Load older writes" />
      <PayloadSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? WRITES[open.writeType].label : ""}
        description={
          open
            ? `${requestLine(open.payload) ?? "Request"}, ${RESULTS[open.result].label.toLowerCase()} after ${open.attempts} ${open.attempts === 1 ? "attempt" : "attempts"}.`
            : ""
        }
        sections={
          open
            ? [
                { label: "Idempotency key", text: open.idempotencyKey },
                ...(open.lastError
                  ? [{ label: "Last error", text: open.lastError }]
                  : []),
                { label: "Request", json: open.payload },
                { label: "Response", json: open.response },
              ]
            : []
        }
      />
    </>
  );
}

function LeadRef({ leadId }: { leadId: string | null }) {
  if (!leadId) return <span className="text-ink-3">None</span>;
  // Lead detail links only once that screen is live (src/lib/flags.ts).
  return isLive("lead-detail") ? (
    <Link
      href={leadHref(leadId)}
      aria-label={`Lead ${leadId}`}
      title={leadId}
      className="rounded-sm font-mono text-meta text-brand-text underline-offset-4 hover:underline focus-visible:shadow-focus focus-visible:outline-none"
    >
      {shortId(leadId)}
    </Link>
  ) : (
    <span title={leadId} className="font-mono text-meta text-ink-2">
      <span aria-hidden="true">{shortId(leadId)}</span>
      <span className="sr-only">Lead {leadId}</span>
    </span>
  );
}

function ResultCell({ entry }: { entry: SyncLogEntry }) {
  const why =
    entry.result === "skipped"
      ? skipReason(entry)
      : entry.result === "failed"
        ? entry.lastError
        : null;
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusPill
        state={RESULTS[entry.result].state}
        label={RESULTS[entry.result].label}
        size="sm"
      />
      {why && (
        <span className="line-clamp-2 max-w-[240px] text-meta text-pretty text-ink-3">
          {why}
        </span>
      )}
    </div>
  );
}

/** "Retry" on a failed write: names the write it will cause before it happens (spec 06). */
function RetryButton({ entry }: { entry: SyncLogEntry }) {
  const retry = useRetryWrite();
  const write = WRITES[entry.writeType];
  const request = requestLine(entry.payload);
  const lead = entry.leadId ? ` for lead ${shortId(entry.leadId)}` : "";

  return (
    <ConfirmDialog
      tone="neutral"
      trigger={
        <Button
          size="sm"
          loading={retry.isPending}
          aria-label={`Retry ${write.label}, ${entry.idempotencyKey}`}
        >
          Retry
        </Button>
      }
      title={`Retry ${write.label}?`}
      description={`This sends the write to GHL again${lead}: it sets ${write.sets}. ${write.after ?? ""}`.trim()}
      confirmLabel="Retry write"
      onConfirm={() =>
        retry.mutate(entry.id, {
          onSuccess: (done) =>
            toast.add(
              done.result === "succeeded"
                ? { title: `${write.label} succeeded`, type: "success" }
                : done.result === "skipped"
                  ? {
                      title: `${write.label} skipped`,
                      description: skipReason(done) ?? undefined,
                    }
                  : {
                      title: `${write.label} failed again`,
                      description: done.lastError ?? undefined,
                      type: "error",
                    },
            ),
          onError: (error) =>
            toast.add(
              error instanceof ApiError && error.code === "conflict"
                ? {
                    title: "This write can no longer be retried",
                    description:
                      "A newer write for this lead replaced it, or it is no longer failed. Nothing was sent.",
                    type: "error",
                  }
                : {
                    title: "The retry did not go through",
                    description: "Nothing was sent. Try again.",
                    type: "error",
                  },
            ),
        })
      }
    >
      <dl className="grid gap-x-3 gap-y-1 text-meta nav:grid-cols-[auto_minmax(0,1fr)]">
        {request && (
          <>
            <dt className="text-ink-3">Request</dt>
            <dd className="font-mono text-ink">{request}</dd>
          </>
        )}
        <dt className="text-ink-3">Idempotency key</dt>
        <dd className="font-mono wrap-anywhere text-ink">
          {entry.idempotencyKey}
        </dd>
      </dl>
      <p className="text-meta text-pretty text-ink-3">
        {`This change may already have reached GHL: a failed write can be a timeout after GHL made the change. Check the contact in GHL first. ${write.twice ?? ""}`.trim()}
      </p>
    </ConfirmDialog>
  );
}

function WebhooksTab() {
  const events = useWebhookEvents();
  const [open, setOpen] = useState<WebhookEventEntry | null>(null);

  if (events.isError && !events.data) {
    return (
      <ErrorState
        title="The webhooks could not be loaded"
        description="Nothing was changed. Check your connection and try again."
        retrying={events.isFetching}
        onRetry={() => events.refetch()}
      />
    );
  }

  const rows = events.data?.pages.flatMap((page) => page.items) ?? [];
  if (events.data && rows.length === 0) {
    return (
      <EmptyState
        variant="empty"
        title="No webhooks received yet"
        body="Every event GHL sends the app lands here, with what was done with it."
      />
    );
  }

  const columns: Column<WebhookEventEntry>[] = [
    {
      id: "time",
      header: "Time",
      locked: true,
      value: (row) => row.createdAt,
      cell: (row) => (
        <LocalTime value={row.createdAt} className="tabular-nums" />
      ),
    },
    {
      id: "event",
      header: "Event",
      value: (row) => WEBHOOK_TYPES[row.type] ?? row.type,
      cell: (row) => WEBHOOK_TYPES[row.type] ?? row.type,
    },
    {
      id: "verified",
      header: "Verified",
      value: (row) => (row.verified ? "Yes" : "No"),
      cell: (row) =>
        row.verified ? (
          "Yes"
        ) : (
          <span className="font-bold text-danger-ink">No</span>
        ),
    },
    {
      id: "outcome",
      header: "Outcome",
      value: (row) => outcomeOf(row.outcome).label,
      cell: (row) => {
        const outcome = outcomeOf(row.outcome);
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusPill state={outcome.state} label={outcome.label} size="sm" />
            {outcome.detail && (
              <span className="line-clamp-2 max-w-[240px] text-meta text-pretty text-ink-3">
                {outcome.detail}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "eventId",
      header: "Event id",
      value: (row) => row.eventId,
      cell: (row) => (
        <span className="block max-w-[280px] font-mono text-meta wrap-anywhere text-ink-2">
          {row.eventId}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      locked: true,
      cell: (row) => (
        <Button
          size="sm"
          aria-label={`Payload of ${WEBHOOK_TYPES[row.type] ?? row.type}, ${row.eventId}`}
          onClick={() => setOpen(row)}
        >
          Payload
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        caption="Webhooks received from GHL, newest first"
        rows={rows}
        columns={columns}
        rowId={(row) => row.id}
        loading={events.isPending}
        searchPlaceholder="Search loaded webhooks"
        densityKey="sync-log"
        defaultDensity="compact"
      />
      <LoadOlder query={events} label="Load older webhooks" />
      <PayloadSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? (WEBHOOK_TYPES[open.type] ?? open.type) : ""}
        description={
          open
            ? `${open.verified ? "Verified" : "Not verified"}, ${outcomeOf(open.outcome).label.toLowerCase()}.`
            : ""
        }
        sections={
          open
            ? [
                { label: "Event id", text: open.eventId },
                { label: "Payload", json: open.payload },
              ]
            : []
        }
      />
    </>
  );
}

function LoadOlder({
  query,
  label,
}: {
  query: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
  };
  label: string;
}) {
  if (!query.hasNextPage) return null;
  return (
    <div className="flex justify-center">
      <Button
        loading={query.isFetchingNextPage}
        onClick={() => query.fetchNextPage()}
      >
        {label}
      </Button>
    </div>
  );
}

type Section =
  | { label: string; text: string; json?: never }
  | { label: string; json: unknown; text?: never };

/** The row's full record, request and response as stored (auth already redacted). */
function PayloadSheet({
  open,
  onClose,
  title,
  description,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  sections: Section[];
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-[560px]"
      >
        <SheetHeader className="border-b border-line pr-12">
          <SheetTitle className="text-small font-bold">{title}</SheetTitle>
          <SheetDescription className="text-meta">
            {description}
          </SheetDescription>
        </SheetHeader>
        <dl className="flex flex-col gap-4 p-4">
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col gap-1.5">
              <dt className="text-micro font-bold tracking-[0.06em] text-ink-3 uppercase">
                {section.label}
              </dt>
              <dd
                className={cn(
                  section.text !== undefined &&
                    "font-mono text-meta wrap-anywhere",
                )}
              >
                {section.text !== undefined ? (
                  section.text
                ) : (
                  <JsonBlock value={section.json} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </SheetContent>
    </Sheet>
  );
}
