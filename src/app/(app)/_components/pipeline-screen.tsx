"use client";

import { type Column, DataTable } from "@vantage/design-system";
import { ArchiveIcon, ShieldQuestionIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { LocalTime } from "@/components/ui/local-time";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import { SyncIndicator, WritePreview } from "@/components/ui/sync-seam";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  useArchiveLead,
  useLeads,
  usePipelineSummary,
} from "@/hooks/use-leads";
import { rememberPipelineSearch } from "@/hooks/use-pipeline-href";
import { useTimeZone } from "@/hooks/use-time-zone";
import { useCan } from "@/hooks/use-viewer";
import { isLive } from "@/lib/flags";
import {
  ACTION_LABEL,
  BOOKING_KIND_LABEL,
  EXIT_LABEL,
  nextStep,
  STAGE_LABEL,
  statusMeta,
  VERDICT_META,
} from "@/lib/leads/rules";
import {
  EXITS,
  type LeadListItem,
  type PipelineSummary,
  parseLeadFilters,
  STAGES,
  UNASSIGNED,
  VERDICTS,
} from "@/lib/leads/schemas";

import { leadHref, REVIEW_QUEUE_HREF } from "../navigation";
import { LEAD_STATUS_GROUPS } from "./lead-statuses";

const SYNC_LOG_HREF = "/admin/sync-log";
const DAY = 86_400_000;

/** Days since GHL's last activity on the lead; null when it never synced (not measured, never 0). */
export const ageInDays = (lead: Pick<LeadListItem, "lastActivityAt">) =>
  lead.lastActivityAt === null
    ? null
    : Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(lead.lastActivityAt).getTime()) / DAY,
        ),
      );

const ageLabel = (days: number | null) =>
  days === null
    ? "Not measured"
    : days === 0
      ? "Today"
      : `${days} ${days === 1 ? "day" : "days"}`;

/** The address filters: the bar's, and `q` from the navbar's lead search. */
const FILTER_KEYS = [
  "tab",
  "verdict",
  "group",
  "owner",
  "archived",
  "q",
] as const;

/**
 * The lead list (spec 07, registry `lead-list`). The address holds the
 * filters (stage, verdict, Lead Status group, rep for admins, archived), so a
 * view can be reloaded and shared; search, sort, density and columns are the
 * kit's DataTable's own. A rep's list is only their leads: the server scopes
 * it, and the rep column and filter are left out.
 */
export function PipelineScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseLeadFilters(
    Object.fromEntries(searchParams),
    useTimeZone(),
  );
  const leads = useLeads(filters);
  const summary = usePipelineSummary();
  const isAdmin = useCan("see_all_leads");

  const search = searchParams.toString();
  useEffect(() => rememberPipelineSearch(search), [search]);

  /** Writes filters to the address. An empty value removes the filter. */
  const setFilters = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const filtered =
    filters.tab !== "open" ||
    Boolean(filters.verdict || filters.group || filters.owner || filters.q) ||
    filters.archived === "true";
  const clearFilters = () =>
    setFilters(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])));

  const suspects = summary.data?.needs.suspects ?? 0;

  return (
    <>
      <PageHeader
        title="Leads"
        description={
          isAdmin
            ? "Every lead, with its verdict, stage and last write to the CRM."
            : "Your leads, with their verdict, stage and last write to the CRM."
        }
      />

      {suspects > 0 && isLive("suspect-review-queue") && (
        <Link
          href={REVIEW_QUEUE_HREF}
          className="flex items-center gap-2 self-start rounded-md bg-amber-soft px-3 py-2 text-small font-semibold text-amber-ink transition-[scale] duration-150 ease-out outline-none focus-visible:shadow-focus active:scale-[0.98]"
        >
          <ShieldQuestionIcon aria-hidden="true" className="size-4" />
          {suspects} {suspects === 1 ? "suspect is" : "suspects are"} waiting
          for review
        </Link>
      )}

      <Filters
        filters={filters}
        summary={summary.data}
        isAdmin={isAdmin}
        onChange={setFilters}
      />

      {/* The navbar's lead search lands here with `q` in the address. */}
      {filters.q && (
        <p className="flex flex-wrap items-center gap-x-2 text-ink-2">
          Leads matching “{filters.q}”
          <Button
            variant="link"
            size="sm"
            className="px-0"
            onClick={() => setFilters({ q: undefined })}
          >
            Clear search
          </Button>
        </p>
      )}

      <LeadTable
        leads={leads}
        isAdmin={isAdmin}
        filtered={filtered}
        archived={filters.archived === "true"}
        onClear={clearFilters}
        onOpen={(lead) => router.push(leadHref(lead.id))}
      />
    </>
  );
}

function Filters({
  filters,
  summary,
  isAdmin,
  onChange,
}: {
  filters: ReturnType<typeof parseLeadFilters>;
  summary: PipelineSummary | undefined;
  isAdmin: boolean;
  onChange: (changes: Record<string, string | undefined>) => void;
}) {
  const ids = {
    stage: useId(),
    verdict: useId(),
    group: useId(),
    owner: useId(),
    archived: useId(),
  };
  const count = (n: number | undefined) => (n === undefined ? "" : ` (${n})`);
  const field = "w-[200px] max-w-full max-nav:w-full";

  return (
    <search
      aria-label="Filter leads"
      className="flex flex-wrap items-end gap-3"
    >
      <Field className={field}>
        <FieldLabel htmlFor={ids.stage}>Stage</FieldLabel>
        <NativeSelect
          id={ids.stage}
          value={filters.tab}
          onChange={(event) =>
            onChange({
              tab:
                event.target.value === "open" ? undefined : event.target.value,
            })
          }
          className="w-full"
        >
          <NativeSelectOption value="open">
            All open{count(summary?.open)}
          </NativeSelectOption>
          {STAGES.map((stage) => (
            <NativeSelectOption key={stage} value={stage}>
              {STAGE_LABEL[stage]}
              {count(summary?.stages[stage])}
            </NativeSelectOption>
          ))}
          {EXITS.map((exit) => (
            <NativeSelectOption key={exit} value={exit}>
              Left: {EXIT_LABEL[exit]}
              {count(summary?.exits[exit])}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field className={field}>
        <FieldLabel htmlFor={ids.verdict}>Verdict</FieldLabel>
        <NativeSelect
          id={ids.verdict}
          value={filters.verdict ?? ""}
          onChange={(event) => onChange({ verdict: event.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="">Any verdict</NativeSelectOption>
          {VERDICTS.map((verdict) => (
            <NativeSelectOption key={verdict} value={verdict}>
              {VERDICT_META[verdict].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field className={field}>
        <FieldLabel htmlFor={ids.group}>Lead Status</FieldLabel>
        <NativeSelect
          id={ids.group}
          value={filters.group ?? ""}
          onChange={(event) => onChange({ group: event.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="">Any Lead Status</NativeSelectOption>
          {LEAD_STATUS_GROUPS.map((group) => (
            <NativeSelectOption key={group} value={group}>
              {group}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {/* The rep filter is the admins' (spec 07): a rep's list is already only theirs. */}
      {isAdmin && (
        <Field className={field}>
          <FieldLabel htmlFor={ids.owner}>Rep</FieldLabel>
          <NativeSelect
            id={ids.owner}
            value={filters.owner ?? ""}
            onChange={(event) => onChange({ owner: event.target.value })}
            className="w-full"
          >
            <NativeSelectOption value="">Any rep</NativeSelectOption>
            <NativeSelectOption value={UNASSIGNED}>
              Unassigned
            </NativeSelectOption>
            {(summary?.owners ?? []).map(({ id, name }) => (
              <NativeSelectOption key={id} value={id}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field className={field}>
        <FieldLabel htmlFor={ids.archived}>Showing</FieldLabel>
        <NativeSelect
          id={ids.archived}
          value={filters.archived ?? ""}
          onChange={(event) => onChange({ archived: event.target.value })}
          className="w-full"
        >
          <NativeSelectOption value="">Active leads</NativeSelectOption>
          <NativeSelectOption value="true">Archived leads</NativeSelectOption>
        </NativeSelect>
      </Field>
    </search>
  );
}

function LeadTable({
  leads,
  isAdmin,
  filtered,
  archived,
  onClear,
  onOpen,
}: {
  leads: ReturnType<typeof useLeads>;
  isAdmin: boolean;
  filtered: boolean;
  archived: boolean;
  onClear: () => void;
  onOpen: (lead: LeadListItem) => void;
}) {
  if (leads.isError && !leads.data) {
    return (
      <ErrorState
        title="The leads could not be loaded"
        description="Nothing was changed. Check your connection and try again."
        retrying={leads.isFetching}
        onRetry={() => leads.refetch()}
      />
    );
  }

  const rows = leads.data?.pages.flatMap((page) => page.items) ?? [];
  if (leads.data && rows.length === 0) {
    // Copy: the registry's lead-list states.empty.
    return filtered ? (
      <EmptyState
        variant="filtered"
        title="No leads match these filters"
        body="Other leads are hidden by the search or by the stage, verdict, status, rep or archive filter."
        action={<Button onClick={onClear}>Clear filters</Button>}
      />
    ) : (
      <EmptyState
        variant="empty"
        title="No leads yet"
        body="New form fills land here automatically."
      />
    );
  }

  const syncHref = isAdmin && isLive("sync-log") ? SYNC_LOG_HREF : undefined;
  const columns: Column<LeadListItem>[] = [
    {
      id: "lead",
      header: "Lead",
      locked: true,
      value: (lead) => `${lead.name} ${lead.company ?? ""}`,
      cell: (lead) => (
        <span className="flex min-w-0 flex-col">
          <Link
            href={leadHref(lead.id)}
            onClick={(event) => event.stopPropagation()}
            className="truncate rounded-sm font-semibold text-ink underline-offset-4 outline-none hover:underline focus-visible:shadow-focus"
          >
            {lead.name}
          </Link>
          <span className="truncate text-meta text-ink-3">
            {lead.company ?? "No company given"}
          </span>
        </span>
      ),
    },
    {
      id: "verdict",
      header: "Verdict",
      value: (lead) => VERDICT_META[lead.verdict].label,
      cell: (lead) => (
        <Badge variant={VERDICT_META[lead.verdict].tone}>
          {VERDICT_META[lead.verdict].label}
        </Badge>
      ),
    },
    {
      id: "stage",
      header: "Stage",
      value: (lead) => stageText(lead),
      cell: (lead) => (
        <span className={lead.exit || !lead.stage ? "text-ink-3" : undefined}>
          {stageText(lead) ?? "Not synced yet"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Lead Status",
      value: (lead) => lead.status?.value ?? null,
      cell: (lead) => {
        const status = statusMeta(lead.status);
        return <Badge variant={status.tone}>{status.label}</Badge>;
      },
    },
    ...(isAdmin
      ? [
          {
            id: "rep",
            header: "Rep",
            value: (lead) => lead.owner?.name ?? null,
            cell: (lead) =>
              lead.owner?.name ?? (
                <span className="text-ink-3">Unassigned</span>
              ),
          } satisfies Column<LeadListItem>,
        ]
      : []),
    {
      id: "age",
      header: "Age",
      title: "Days since the lead's last activity",
      numeric: true,
      value: ageInDays,
      cell: (lead) => {
        const days = ageInDays(lead);
        return (
          <span className={days === null ? "text-ink-3" : undefined}>
            {ageLabel(days)}
          </span>
        );
      },
    },
    {
      id: "booking",
      header: "Next booking",
      value: (lead) => lead.nextBooking?.time ?? null,
      cell: (lead) =>
        lead.nextBooking ? (
          <span className="flex flex-col">
            <LocalTime value={lead.nextBooking.time} className="tabular-nums" />
            <span className="text-meta text-ink-3">
              {BOOKING_KIND_LABEL[lead.nextBooking.kind]}
            </span>
          </span>
        ) : (
          <span className="text-ink-3">None booked</span>
        ),
    },
    {
      id: "next",
      header: "Next step",
      value: (lead) => nextStepOf(lead).label,
      cell: (lead) => {
        const step = nextStepOf(lead);
        return (
          <span
            title={step.hint}
            className={step.action ? "font-semibold" : "text-ink-3"}
          >
            {step.label}
          </span>
        );
      },
    },
    {
      id: "sync",
      header: "CRM",
      title: "The lead's last write to the CRM",
      locked: true,
      cell: (lead) => <SyncIndicator entry={lead.lastSync} href={syncHref} />,
    },
    ...(archived
      ? []
      : [
          {
            id: "actions",
            header: "Actions",
            locked: true,
            cell: (lead) => <ArchiveButton lead={lead} />,
          } satisfies Column<LeadListItem>,
        ]),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div
        // The rows on screen stay, dimmed, until the new ones arrive.
        aria-busy={leads.isPlaceholderData || undefined}
        className="transition-opacity duration-150 ease-out aria-busy:opacity-60"
      >
        <DataTable
          caption={archived ? "Archived leads" : "Leads"}
          rows={rows}
          columns={columns}
          rowId={(lead) => lead.id}
          loading={leads.isPending}
          searchPlaceholder="Search name or company"
          densityKey="lead-list"
          onRowClick={onOpen}
          emptyTitle="No leads yet"
          emptyBody="New form fills land here automatically."
        />
      </div>
      {/* ponytail: search and sort run over the loaded pages (25 a page);
          past that, "Show more" loads the rest. Move sort to the address
          (the API takes sort and dir) when lists outgrow a few pages. */}
      {leads.hasNextPage && (
        <div className="flex justify-center">
          <Button
            loading={leads.isFetchingNextPage}
            onClick={() => leads.fetchNextPage()}
          >
            Show more leads
          </Button>
        </div>
      )}
    </div>
  );
}

const stageText = (lead: LeadListItem) =>
  lead.exit
    ? `Left: ${EXIT_LABEL[lead.exit]}`
    : lead.stage
      ? STAGE_LABEL[lead.stage]
      : null;

/**
 * The row's next step, from the same rule lead detail uses.
 * ponytail: a list row knows only its next booking, not past ones, so a lead
 * whose discovery call is done reads "Open deck" here until its page is open.
 */
function nextStepOf(lead: LeadListItem) {
  const step = nextStep({
    ...lead,
    bookings: lead.nextBooking ? [lead.nextBooking] : [],
  });
  return {
    action: step.main,
    label: step.main ? ACTION_LABEL[step.main] : "Nothing to do",
    hint: step.hint,
  };
}

/** Archive: a soft delete in the app only (spec 07). It writes nothing to the CRM. */
function ArchiveButton({ lead }: { lead: LeadListItem }) {
  const archive = useArchiveLead();
  const [reason, setReason] = useState("");
  const reasonId = useId();

  return (
    // The dialog renders in a portal, but its clicks still bubble here: stop
    // them before they reach the row, which would open the lead.
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: only stops propagation
    <div onClick={(event) => event.stopPropagation()}>
      <ConfirmDialog
        tone="neutral"
        trigger={
          <Button
            size="icon-sm"
            variant="ghost"
            loading={archive.isPending}
            aria-label={`Archive ${lead.name}`}
            title="Archive"
          >
            <ArchiveIcon aria-hidden="true" />
          </Button>
        }
        title={`Archive ${lead.name}?`}
        description="The lead leaves this list and stays in the app, under Showing: Archived leads."
        confirmLabel="Archive lead"
        onConfirm={() =>
          archive.mutate(
            {
              leadId: lead.id,
              input: reason.trim() ? { reason: reason.trim() } : {},
            },
            {
              onSuccess: () =>
                toast.add({
                  title: `Archived ${lead.name}`,
                  description: "Nothing was written to the CRM.",
                  type: "success",
                }),
              onError: () =>
                toast.add({
                  title: "The lead was not archived",
                  description: "Nothing changed. Try again.",
                  type: "error",
                }),
            },
          )
        }
      >
        <Field>
          <FieldLabel htmlFor={reasonId}>Reason (optional)</FieldLabel>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <WritePreview>
          Nothing in the CRM. Archiving happens in this app only, so the lead
          stays as it is in the CRM.
        </WritePreview>
      </ConfirmDialog>
    </div>
  );
}
