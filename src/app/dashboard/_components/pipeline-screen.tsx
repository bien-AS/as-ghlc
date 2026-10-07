"use client";

import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListRow, ListRowName } from "@/components/ui/list-row";
import { LocalTime } from "@/components/ui/local-time";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import { StatusLine } from "@/components/ui/status-line";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeads, usePipelineSummary } from "@/hooks/use-leads";
import { rememberPipelineSearch } from "@/hooks/use-pipeline-href";
import { useTimeZone } from "@/hooks/use-time-zone";
import {
  BOOKING_KIND_LABEL,
  EXIT_LABEL,
  STAGE_LABEL,
  STATUS_META,
  tabLabel,
  VERDICT_META,
} from "@/lib/leads/rules";
import {
  EXITS,
  type LeadListItem,
  type Need,
  type PipelineSummary,
  type PipelineTab,
  parseLeadFilters,
  STAGES,
  VERDICTS,
} from "@/lib/leads/schemas";
import { cn } from "@/lib/utils";

import { leadHref, SUSPECTS_HREF } from "../navigation";

const NEED_LABEL: Record<Need, string> = {
  suspects: "Suspects to review",
  calls_today: "Calls today",
  proposals: "Proposals to send",
  invoices: "Invoice drafts",
};

/** The column template shared by the heading row and every lead row, from the `nav` breakpoint up. */
const COLUMNS =
  "nav:grid nav:grid-cols-[minmax(0,1.4fr)_minmax(0,1.5fr)_8.5rem_minmax(0,1.1fr)_minmax(0,0.9fr)] nav:items-center nav:gap-4";

const SEARCH_DELAY = 300;

/**
 * The Pipeline (spec 05): what needs the rep, the stages with their counts and
 * the lead list. The page address holds every filter; controls read from it
 * and write to it, so a view can be reloaded, shared and returned to.
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

  const search = searchParams.toString();
  useEffect(() => rememberPipelineSearch(search), [search]);

  /** Writes filters to the address. An empty value removes the filter. */
  const setFilters = (
    changes: Record<string, string | undefined>,
    { replace = false } = {},
  ) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };

  const filtered = Boolean(
    filters.q || filters.verdict || filters.owner || filters.needs,
  );
  const clearFilters = () =>
    setFilters({
      q: undefined,
      verdict: undefined,
      owner: undefined,
      needs: undefined,
    });

  return (
    <>
      <PageHeader title="Pipeline" />

      <NeedsStrip
        summary={summary.data}
        selected={filters.needs}
        onSelect={(need) =>
          // A "needs you" view is taken across every open stage.
          setFilters({
            needs: filters.needs === need ? undefined : need,
            tab: undefined,
          })
        }
      />

      {summary.isError && (
        <p role="alert" className="flex flex-wrap items-center gap-2">
          The counts could not be loaded.
          <Button
            size="sm"
            loading={summary.isFetching}
            onClick={() => summary.refetch()}
          >
            Try again
          </Button>
        </p>
      )}

      <Tabs
        value={filters.tab}
        onValueChange={(tab) =>
          setFilters({ tab: tab === "open" ? undefined : String(tab) })
        }
        className="gap-4"
      >
        <StageTabs summary={summary.data} />

        <TabsContent value={filters.tab} className="flex flex-col gap-3">
          <Filters
            q={filters.q ?? ""}
            verdict={filters.verdict ?? ""}
            owner={filters.owner ?? ""}
            owners={summary.data?.owners ?? []}
            onSearch={(q) => setFilters({ q }, { replace: true })}
            onChange={setFilters}
          />
          <LeadList
            leads={leads}
            tab={filters.tab}
            filtered={filtered}
            describeFilters={() =>
              [
                filters.q && `“${filters.q}”`,
                filters.verdict &&
                  `verdict ${VERDICT_META[filters.verdict].label}`,
                filters.owner &&
                  `rep ${summary.data?.owners.find((owner) => owner.id === filters.owner)?.name ?? "selected"}`,
                filters.needs && NEED_LABEL[filters.needs].toLowerCase(),
              ]
                .filter(Boolean)
                .join(", ")
            }
            pipelineEmpty={
              summary.data !== undefined &&
              summary.data.open +
                EXITS.reduce(
                  (sum, exit) => sum + summary.data.exits[exit],
                  0,
                ) ===
                0
            }
            onClear={clearFilters}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function NeedsStrip({
  summary,
  selected,
  onSelect,
}: {
  summary: PipelineSummary | undefined;
  selected: Need | undefined;
  onSelect: (need: Need) => void;
}) {
  const tile =
    "flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-control border border-border bg-card px-3 py-2 text-left outline-none transition-[background-color,border-color,scale] duration-150 ease-out hover:bg-secondary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] aria-disabled:pointer-events-none aria-disabled:opacity-40 aria-pressed:border-foreground aria-pressed:bg-secondary disabled:pointer-events-none disabled:opacity-40";

  return (
    <section aria-labelledby="needs-you" className="flex flex-col gap-2">
      <h2 id="needs-you" className="label-caps">
        Needs you
      </h2>
      <div className="grid grid-cols-2 gap-2 wide:grid-cols-4">
        {(Object.keys(NEED_LABEL) as Need[]).map((need) => {
          const count = summary?.needs[need];
          const body = (
            <>
              <span className="font-heading text-xl leading-none font-bold tabular-nums">
                {count ?? (
                  // No number rather than a zero when the counts are unavailable.
                  <>
                    <span aria-hidden="true">–</span>
                    <span className="sr-only">unavailable</span>
                  </>
                )}
              </span>
              <span className="text-muted-foreground">{NEED_LABEL[need]}</span>
            </>
          );
          // Suspects open their own screen instead of filtering the list.
          return need === "suspects" && count ? (
            <Link key={need} href={SUSPECTS_HREF} className={tile}>
              {body}
            </Link>
          ) : (
            <button
              key={need}
              type="button"
              // Zero is shown as zero and its button is inactive.
              disabled={!count}
              aria-pressed={need === "suspects" ? undefined : selected === need}
              onClick={() => onSelect(need)}
              className={tile}
            >
              {body}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StageTabs({ summary }: { summary: PipelineSummary | undefined }) {
  const tab = (value: PipelineTab, count: number | undefined) => (
    <TabsTrigger key={value} value={value} className="flex-none px-2">
      {tabLabel(value)}
      {count !== undefined && (
        <span className="font-normal text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
    </TabsTrigger>
  );
  return (
    // Scrolls sideways on narrow screens; the page itself never does.
    <div className="-mx-4 overflow-x-auto px-4 pb-1.5 nav:-mx-6 nav:px-6">
      <TabsList variant="line" aria-label="Stages and exits" className="h-8">
        {tab("open", summary?.open)}
        {STAGES.map((stage) => tab(stage, summary?.stages[stage]))}
        {/* The three exits, set apart from the stages. */}
        <span aria-hidden="true" className="mx-2 h-4 w-px shrink-0 bg-border" />
        {EXITS.map((exit) => tab(exit, summary?.exits[exit]))}
      </TabsList>
    </div>
  );
}

function Filters({
  q,
  verdict,
  owner,
  owners,
  onSearch,
  onChange,
}: {
  q: string;
  verdict: string;
  owner: string;
  owners: PipelineSummary["owners"];
  onSearch: (q: string) => void;
  onChange: (changes: Record<string, string | undefined>) => void;
}) {
  // What is being typed. The address stays the source of truth: when it
  // changes from outside (Back, Clear filters, the navbar search), the field
  // follows it.
  const [draft, setDraft] = useState(q);
  const [seen, setSeen] = useState(q);
  if (q !== seen) {
    setSeen(q);
    setDraft(q);
  }
  // Below the `nav` breakpoint the two selects sit behind this control.
  const [open, setOpen] = useState(false);

  const latest = useRef(onSearch);
  latest.current = onSearch;
  useEffect(() => {
    const text = draft.trim();
    if (text === q) return;
    const timer = setTimeout(() => latest.current(text), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [draft, q]);

  const active = Number(Boolean(verdict)) + Number(Boolean(owner));

  return (
    <div className="flex flex-col gap-2 nav:flex-row nav:items-center">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative flex-1 nav:max-w-xs">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search by name, company or email"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Name, company or email"
            autoComplete="off"
            className="pl-8"
          />
        </div>
        <Button
          aria-expanded={open}
          aria-controls="pipeline-filters"
          onClick={() => setOpen(!open)}
          className="nav:hidden"
        >
          <SlidersHorizontalIcon aria-hidden="true" data-icon="inline-start" />
          Filters{active > 0 && ` (${active})`}
        </Button>
      </div>
      <div
        id="pipeline-filters"
        className={cn("gap-2 nav:flex", open ? "flex" : "hidden")}
      >
        <NativeSelect
          aria-label="Verdict"
          value={verdict}
          onChange={(event) => onChange({ verdict: event.target.value })}
          className="flex-1 nav:flex-none"
        >
          <NativeSelectOption value="">Any verdict</NativeSelectOption>
          {VERDICTS.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {value === "awaiting"
                ? "Awaiting verdict"
                : VERDICT_META[value].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {/* Spec 12: the rep filter is for a role that sees more than one
            rep's leads. Staff are sent only their own rep, so it is left out. */}
        {owners.length > 1 && (
          <NativeSelect
            aria-label="Rep"
            value={owner}
            onChange={(event) => onChange({ owner: event.target.value })}
            className="flex-1 nav:flex-none"
          >
            <NativeSelectOption value="">Any rep</NativeSelectOption>
            {owners.map(({ id, name }) => (
              <NativeSelectOption key={id} value={id}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </div>
    </div>
  );
}

function LeadList({
  leads,
  tab,
  filtered,
  describeFilters,
  pipelineEmpty,
  onClear,
}: {
  leads: ReturnType<typeof useLeads>;
  tab: PipelineTab;
  filtered: boolean;
  describeFilters: () => string;
  pipelineEmpty: boolean;
  onClear: () => void;
}) {
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = leads;

  // Reaching the end of the list asks for the next page. The button below
  // does the same for keyboards and for browsers without the observer.
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = end.current;
    if (
      !element ||
      !hasNextPage ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (leads.isPending) return <LeadListSkeleton />;

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

  const items = leads.data.pages.flatMap((page) => page.items);
  const total = leads.data.pages[0]?.total ?? 0;

  if (items.length === 0) {
    if (filtered) {
      return (
        <EmptyState
          title="No leads match"
          description={`Nothing in ${tabLabel(tab)} matches ${describeFilters()}.`}
          action={<Button onClick={onClear}>Clear filters</Button>}
        />
      );
    }
    return pipelineEmpty ? (
      <EmptyState
        title="No leads yet"
        description="Leads appear here when they come in from your CRM."
      />
    ) : (
      <EmptyState title={`No leads in ${tabLabel(tab)}.`} />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p
        aria-live="polite"
        className="flex min-h-7 flex-wrap items-center gap-x-3 text-muted-foreground"
      >
        {total} {total === 1 ? "lead" : "leads"}
        {filtered && " match"}
        {filtered && (
          <Button variant="link" size="sm" onClick={onClear} className="px-0">
            Clear filters
          </Button>
        )}
      </p>

      <div
        // The rows on screen stay, dimmed, until the new ones arrive.
        aria-busy={leads.isPlaceholderData}
        className={cn(
          "overflow-hidden rounded-panel bg-card ring-1 ring-border transition-opacity duration-150",
          leads.isPlaceholderData && "opacity-60",
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "hidden border-b border-border px-4 py-2 label-caps",
            COLUMNS,
          )}
        >
          <span>Lead</span>
          <span>Status</span>
          <span>Verdict</span>
          <span>Next call</span>
          <span>Owner</span>
        </div>
        <ul className="divide-y divide-border">
          {items.map((lead) => (
            <li
              key={lead.id}
              className="[contain-intrinsic-size:auto_3.75rem] [content-visibility:auto]"
            >
              <LeadRow lead={lead} showStage={tab === "open"} />
            </li>
          ))}
        </ul>
      </div>

      <div ref={end} className="flex min-h-9 items-center justify-center">
        {leads.isFetchNextPageError ? (
          <p role="alert" className="flex flex-wrap items-center gap-2">
            More leads could not be loaded.
            <Button size="sm" onClick={() => fetchNextPage()}>
              Try again
            </Button>
          </p>
        ) : isFetchingNextPage ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Loading more leads
          </p>
        ) : hasNextPage ? (
          <Button onClick={() => fetchNextPage()}>Show more leads</Button>
        ) : (
          <p className="text-muted-foreground">
            All {total} {total === 1 ? "lead" : "leads"} shown
          </p>
        )}
      </div>
    </div>
  );
}

function LeadRow({
  lead,
  showStage,
}: {
  lead: LeadListItem;
  showStage: boolean;
}) {
  const status = STATUS_META[lead.status];
  const verdict = VERDICT_META[lead.verdict];
  return (
    <ListRow
      href={leadHref(lead.id)}
      className={cn("flex flex-col gap-1.5", COLUMNS)}
    >
      <span className="min-w-0">
        <ListRowName removed={Boolean(lead.exit)}>{lead.name}</ListRowName>
        <span
          title={lead.company ?? undefined}
          className="block truncate text-muted-foreground"
        >
          {lead.company ?? "No company given"}
        </span>
      </span>

      <span className="min-w-0">
        <StatusLine tone={status.tone}>{status.label}</StatusLine>
        {lead.exit ? (
          <span className="block truncate text-muted-foreground">
            Left the pipeline: {EXIT_LABEL[lead.exit]}
          </span>
        ) : (
          showStage && (
            <span className="block truncate text-muted-foreground">
              {STAGE_LABEL[lead.stage]}
            </span>
          )
        )}
      </span>

      {/* Below `nav`, the verdict and the next call share the last line. */}
      <span className="contents max-nav:flex max-nav:flex-wrap max-nav:items-center max-nav:gap-x-3 max-nav:gap-y-1">
        <span>
          <Badge variant={verdict.tone}>{verdict.label}</Badge>
        </span>
        <span className="min-w-0 nav:block">
          {lead.nextBooking ? (
            <>
              <LocalTime value={lead.nextBooking.time} className="nav:block" />
              <span className="text-muted-foreground max-nav:before:content-['_·_'] nav:block nav:truncate">
                {BOOKING_KIND_LABEL[lead.nextBooking.kind]}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No call booked</span>
          )}
        </span>
      </span>

      <span
        title={lead.owner.name}
        className="hidden truncate text-muted-foreground nav:block"
      >
        {lead.owner.name}
      </span>
    </ListRow>
  );
}

function LeadListSkeleton() {
  return (
    <output
      aria-label="Loading leads"
      className="mt-9 divide-y divide-border overflow-hidden rounded-panel bg-card ring-1 ring-border"
    >
      {["a", "b", "c", "d", "e", "f", "g", "h"].map((row) => (
        <div key={row} className={cn("flex flex-col gap-2 px-4 py-3", COLUMNS)}>
          <span className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-28" />
          </span>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="hidden h-4 w-24 nav:block" />
        </div>
      ))}
    </output>
  );
}
