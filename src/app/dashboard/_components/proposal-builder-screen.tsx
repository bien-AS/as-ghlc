"use client";

import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { HintLine } from "@/components/ui/hint-line";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { ListRow, ListRowName } from "@/components/ui/list-row";
import { LocalTime } from "@/components/ui/local-time";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { PanelSection } from "@/components/ui/panel-section";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  useProposal,
  useProposalLeads,
  useProposalWrite,
} from "@/hooks/use-proposals";
import { useViewer } from "@/hooks/use-viewer";
import { ApiError } from "@/lib/api/client";
import { clearErrorOnEdit, type FieldErrors } from "@/lib/forms";
import { EXIT_LABEL, STAGE_LABEL } from "@/lib/leads/rules";
import {
  formatUsd,
  proposalBlockedReason,
  proposalStatusMeta,
  sendBlockedReason,
  totalOf,
} from "@/lib/proposals/rules";
import {
  type CatalogueService,
  type LineItem,
  type Proposal,
  type ProposalClient,
  type ProposalDraftInput,
  type ProposalView,
  parseProposalLead,
  proposalDraftInputSchema,
} from "@/lib/proposals/schemas";
import { cn } from "@/lib/utils";

import {
  invoiceHref,
  leadHref,
  PIPELINE_HREF,
  PROPOSAL_BUILDER_HREF,
  proposalHref,
} from "../navigation";

/** The 44px Touch Rule: taller below `nav` and on a coarse pointer. */
const TOUCH = "max-nav:min-h-11 pointer-coarse:min-h-11";

/**
 * The proposal builder (spec 14). With no lead in the address it is a picker;
 * with `?lead=` it is that lead's proposal: generate, edit, review and send,
 * then read-only while the lead views and signs it.
 */
export function ProposalBuilderScreen({
  missing = false,
}: {
  /** The server already knows this lead does not exist for this viewer. */
  missing?: boolean;
}) {
  const searchParams = useSearchParams();
  const leadId = parseProposalLead(Object.fromEntries(searchParams));
  return leadId ? (
    // A fresh builder per lead, so nothing typed for one carries to another.
    <Builder key={leadId} leadId={leadId} missing={missing} />
  ) : (
    <Picker />
  );
}

// --- the picker ---------------------------------------------------------------

function Picker() {
  const leads = useProposalLeads();

  const header = (
    <PageHeader
      title="Proposal builder"
      description="Choose a lead to build, send or check its proposal. A lead appears here once it is Qualified."
    />
  );

  if (leads.isPending) {
    return (
      <>
        {header}
        <output aria-label="Loading leads" className="flex flex-col gap-px">
          {["a", "b", "c", "d", "e"].map((row) => (
            <Skeleton
              key={row}
              className="h-14 rounded-none first:rounded-t-panel last:rounded-b-panel"
            />
          ))}
        </output>
      </>
    );
  }
  if (leads.isError && !leads.data) {
    return (
      <>
        {header}
        <ErrorState
          title="The leads could not be loaded"
          description="Nothing was changed. Check your connection and try again."
          retrying={leads.isFetching}
          onRetry={() => leads.refetch()}
        />
      </>
    );
  }
  if (leads.data.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="No lead is ready for a proposal"
          description="A lead appears here once it is marked Qualified after its discovery call."
          action={
            <LinkButton href={PIPELINE_HREF}>Go to the Pipeline</LinkButton>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <section
        aria-label="Leads"
        className="overflow-hidden rounded-panel bg-card ring-1 ring-border"
      >
        <ul className="divide-y divide-border">
          {leads.data.map((lead) => {
            const status = proposalStatusMeta(lead.proposalStatus);
            return (
              <li key={lead.id}>
                <ListRow
                  href={proposalHref(lead.id)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1"
                >
                  <span className="min-w-0 flex-1 basis-48">
                    <ListRowName>{lead.name}</ListRowName>
                    {lead.company && (
                      <span className="block truncate text-muted-foreground">
                        {lead.company}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground nav:w-48">
                    {STAGE_LABEL[lead.stage]}
                  </span>
                  <span className="nav:w-36">
                    <Badge variant={status.tone}>
                      Proposal: {status.label}
                    </Badge>
                  </span>
                </ListRow>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

// --- one lead's proposal -------------------------------------------------------

type Write = ReturnType<typeof useProposalWrite>;

function Builder({ leadId, missing }: { leadId: string; missing: boolean }) {
  const proposal = useProposal(missing ? undefined : leadId);
  const write = useProposalWrite(leadId);

  const notFound =
    missing ||
    (proposal.error instanceof ApiError && proposal.error.status === 404);
  if (notFound) {
    return (
      <EmptyState
        title="This lead does not exist"
        description="It may have been removed, the link may be wrong, or it may belong to another rep."
        action={
          <LinkButton href={PROPOSAL_BUILDER_HREF}>Choose a lead</LinkButton>
        }
      />
    );
  }
  if (proposal.isPending) return <BuilderSkeleton />;
  if (proposal.isError && !proposal.data) {
    return (
      <ErrorState
        title="This proposal could not be loaded"
        description="Nothing was changed. Check your connection and try again."
        retrying={proposal.isFetching}
        onRetry={() => proposal.refetch()}
        action={
          <LinkButton href={PROPOSAL_BUILDER_HREF}>Choose a lead</LinkButton>
        }
      />
    );
  }

  const view = proposal.data;
  const { lead } = view;
  const status = proposalStatusMeta(view.proposal?.status);

  return (
    <>
      <Link
        href={leadHref(lead.id)}
        className="inline-flex items-center gap-1 self-start rounded-md font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {lead.name}
      </Link>

      <PageHeader title={`Proposal for ${lead.name}`}>
        <ul
          aria-label="Where this proposal stands"
          className="flex flex-wrap gap-2"
        >
          <li>
            <Badge variant={status.tone}>Proposal: {status.label}</Badge>
          </li>
          <li>
            <Badge>Stage: {STAGE_LABEL[lead.stage]}</Badge>
          </li>
        </ul>
      </PageHeader>

      {!view.proposal ? (
        view.canStart ? (
          <NotStarted view={view} write={write} />
        ) : (
          <EmptyState
            title="This lead cannot have a proposal yet"
            description={proposalBlockedReason(lead)}
            action={
              <LinkButton href={leadHref(lead.id)}>Back to the lead</LinkButton>
            }
          />
        )
      ) : view.proposal.status === "draft" && !lead.exit ? (
        <DraftEditor view={view} proposal={view.proposal} write={write} />
      ) : (
        <ReadOnly view={view} proposal={view.proposal} write={write} />
      )}
    </>
  );
}

/** What went wrong with the last write, and the way to repeat it. */
function WriteFailure({
  write,
  onRetry,
}: {
  write: Write;
  /** Repeats the write as the screen would make it now. */
  onRetry: () => void;
}) {
  if (!write.isError || write.isPending) return null;
  const changed = write.error instanceof ApiError && write.error.status === 409;
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center gap-3">
        {changed ? (
          "This proposal had changed elsewhere, so that did not apply. You are now looking at the latest version."
        ) : (
          <>
            That did not go through. The proposal is unchanged.
            <Button size="sm" className={TOUCH} onClick={onRetry}>
              Try again
            </Button>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}

const Missing = () => (
  <>
    <span aria-hidden="true">–</span>
    <span className="sr-only">Not given</span>
  </>
);

function ClientDetails({ client }: { client: ProposalClient }) {
  return (
    <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 [&_dd]:wrap-break-word [&_dt]:text-muted-foreground">
      <dt>Name</dt>
      <dd>{client.name}</dd>
      <dt>Company</dt>
      <dd>{client.company || <Missing />}</dd>
      <dt>Email</dt>
      <dd>{client.email || <Missing />}</dd>
    </dl>
  );
}

// --- not started ---------------------------------------------------------------

function NotStarted({ view, write }: { view: ProposalView; write: Write }) {
  const generate = () =>
    write.mutate(
      { action: "generate" },
      { onSuccess: () => toast.add({ title: "Draft ready", type: "success" }) },
    );
  return (
    <div className="flex max-w-[44rem] flex-col gap-4">
      <PanelSection title="Client">
        <ClientDetails client={view.client} />
        <p className="text-muted-foreground">
          From the lead. You can correct these once the draft exists.
        </p>
      </PanelSection>
      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          className={cn("self-start", TOUCH)}
          loading={write.isPending}
          onClick={generate}
        >
          Generate proposal
        </Button>
        <WriteFailure write={write} onRetry={generate} />
        <HintLine>
          Starts a draft with services suggested from the lead's form answers
          and budget. You set every price before anything is sent. Sample data:
          the suggestion is made up and nothing leaves Dealwright.
        </HintLine>
      </div>
    </div>
  );
}

// --- draft ---------------------------------------------------------------------

type Row = { key: number; service: string; description: string; price: string };

const toRows = (lineItems: LineItem[]): Row[] =>
  lineItems.map((item, key) => ({
    key,
    service: item.service,
    description: item.description,
    price: String(item.price),
  }));

/** What the rep typed as a price, as dollars. NaN when it is not a number. */
const priceOf = (text: string) => {
  const cleaned = text.replace(/[$,\s]/g, "");
  return cleaned === "" ? Number.NaN : Number(cleaned);
};

function DraftEditor({
  view,
  proposal,
  write,
}: {
  view: ProposalView;
  proposal: Proposal;
  write: Write;
}) {
  const hydrated = useHydrated();
  const [client, setClient] = useState(proposal.client);
  const [rows, setRows] = useState(() => toRows(proposal.lineItems));
  const [context, setContext] = useState(proposal.context);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [picked, setPicked] = useState(view.catalogue[0]?.id ?? "");
  const nextKey = useRef(rows.length);
  // The row just added, so focus can move to it.
  const [added, setAdded] = useState<number>();
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (added === undefined) return;
    form.current
      ?.querySelector<HTMLInputElement>(`[name="rows.${added}.service"]`)
      ?.focus();
  }, [added]);

  const lineItems: LineItem[] = rows.map((row) => ({
    service: row.service,
    description: row.description,
    price: priceOf(row.price),
  }));
  const total = totalOf(
    lineItems.map((item) => ({ price: item.price > 0 ? item.price : 0 })),
  );
  const draft: ProposalDraftInput = { client, lineItems, context };

  // What the server holds, in the form's own shape, to tell whether it differs.
  const saved = JSON.stringify({
    client: proposal.client,
    lineItems: proposal.lineItems,
    context: proposal.context,
  });
  const parsed = proposalDraftInputSchema.safeParse(draft);
  const dirty = !parsed.success || JSON.stringify(parsed.data) !== saved;

  const busy = write.isPending;
  const saving = busy && write.variables?.action === "save";
  const sending = busy && write.variables?.action === "send";
  const blocked = sendBlockedReason(proposal);

  const addRow = (service?: CatalogueService) => {
    const key = nextKey.current++;
    setRows((current) => [
      ...current,
      {
        key,
        service: service?.name ?? "",
        description: service?.description ?? "",
        price: service ? String(service.price) : "",
      },
    ]);
    setAdded(key);
  };
  const editRow = (key: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );

  const save = () => {
    if (busy) return;
    if (!parsed.success) {
      const found: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        // Line items are named by their row's key, which survives a removal.
        const [head, index, field] = issue.path;
        const name =
          head === "lineItems" && typeof index === "number"
            ? `rows.${rows[index].key}.${String(field)}`
            : issue.path.join(".");
        found[name] ??= issue.message;
      }
      setErrors(found);
      Array.from(form.current?.elements ?? [])
        .find(
          (element): element is HTMLInputElement =>
            "name" in element && Boolean(found[String(element.name)]),
        )
        ?.focus();
      return;
    }
    setErrors({});
    write.mutate(
      { action: "save", input: parsed.data },
      {
        onSuccess: ({ proposal: stored }) => {
          // Show what was stored (trimmed), so the form is no longer "changed".
          if (stored) {
            setClient(stored.client);
            setRows(toRows(stored.lineItems));
            nextKey.current = stored.lineItems.length;
            setContext(stored.context);
          }
          toast.add({ title: "Draft saved", type: "success" });
        },
      },
    );
  };

  const send = () =>
    write.mutate(
      { action: "send" },
      {
        onSuccess: () =>
          toast.add({
            title: `Proposal sent: ${view.lead.name}`,
            type: "success",
          }),
      },
    );

  return (
    <div className="grid gap-4 wide:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] wide:items-start">
      <form
        ref={form}
        // Never GET: a submit the browser handles itself must not put fields in the address.
        method="post"
        noValidate
        aria-busy={busy}
        onChange={clearErrorOnEdit(setErrors)}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        className="flex min-w-0 flex-col gap-4"
      >
        <PanelSection title="Client">
          <div className="grid gap-x-3 gap-y-5 nav:grid-cols-2">
            <FormField
              label="Name"
              name="client.name"
              autoComplete="off"
              value={client.name}
              onChange={(event) =>
                setClient({ ...client, name: event.target.value })
              }
              error={errors["client.name"]}
              readOnly={busy}
              className={TOUCH}
              required
            />
            <FormField
              label="Company"
              name="client.company"
              autoComplete="off"
              value={client.company}
              onChange={(event) =>
                setClient({ ...client, company: event.target.value })
              }
              error={errors["client.company"]}
              readOnly={busy}
              className={TOUCH}
            />
            <FormField
              label="Email"
              name="client.email"
              type="email"
              autoComplete="off"
              value={client.email}
              onChange={(event) =>
                setClient({ ...client, email: event.target.value })
              }
              error={errors["client.email"]}
              hint="The proposal is sent to this address."
              readOnly={busy}
              className={TOUCH}
            />
          </div>
        </PanelSection>

        <PanelSection title="Services">
          {rows.length === 0 ? (
            <p className="text-muted-foreground">
              No services yet. Add one from the catalogue, or write your own.
            </p>
          ) : (
            <>
              <div
                aria-hidden="true"
                className={cn("hidden label-caps nav:grid", ROW_COLUMNS)}
              >
                <span>Service</span>
                <span>Description</span>
                <span>Price (USD)</span>
              </div>
              <ul className="flex flex-col gap-4 max-nav:divide-y max-nav:divide-border nav:gap-2">
                {rows.map((row, index) => (
                  <li
                    key={row.key}
                    className={cn(
                      "grid gap-2 max-nav:pt-4 max-nav:first:pt-0",
                      ROW_COLUMNS,
                    )}
                  >
                    <RowField
                      label="Service"
                      line={index + 1}
                      name={`rows.${row.key}.service`}
                      value={row.service}
                      onChange={(service) => editRow(row.key, { service })}
                      error={errors[`rows.${row.key}.service`]}
                      readOnly={busy}
                    />
                    <RowField
                      label="Description"
                      line={index + 1}
                      name={`rows.${row.key}.description`}
                      value={row.description}
                      onChange={(description) =>
                        editRow(row.key, { description })
                      }
                      error={errors[`rows.${row.key}.description`]}
                      readOnly={busy}
                    />
                    <RowField
                      label="Price (USD)"
                      line={index + 1}
                      name={`rows.${row.key}.price`}
                      value={row.price}
                      onChange={(price) => editRow(row.key, { price })}
                      error={errors[`rows.${row.key}.price`]}
                      readOnly={busy}
                      inputMode="decimal"
                      className="tabular-nums nav:text-right"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${row.service.trim() || `line ${index + 1}`}`}
                      disabled={busy}
                      className="max-nav:min-h-11 max-nav:min-w-11 max-nav:justify-self-end pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                      onClick={() => {
                        setRows((current) =>
                          current.filter((other) => other.key !== row.key),
                        );
                        setErrors((current) =>
                          Object.fromEntries(
                            Object.entries(current).filter(
                              ([name]) => !name.startsWith(`rows.${row.key}.`),
                            ),
                          ),
                        );
                      }}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {errors.lineItems && (
            <p role="alert" className="text-sm text-crit">
              {errors.lineItems}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="catalogue" className="text-sm font-semibold">
                From the catalogue
              </label>
              <div className="flex flex-wrap gap-3">
                <NativeSelect
                  id="catalogue"
                  value={picked}
                  disabled={busy}
                  onChange={(event) => setPicked(event.target.value)}
                  className={cn(
                    "max-w-full",
                    "[&_select]:max-nav:min-h-11 [&_select]:pointer-coarse:min-h-11",
                  )}
                >
                  {view.catalogue.map((service) => (
                    <NativeSelectOption key={service.id} value={service.id}>
                      {service.name} ({formatUsd(service.price)})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button
                  className={TOUCH}
                  disabled={busy}
                  onClick={() =>
                    addRow(view.catalogue.find(({ id }) => id === picked))
                  }
                >
                  Add service
                </Button>
              </div>
            </div>
            <Button className={TOUCH} disabled={busy} onClick={() => addRow()}>
              Add a custom service
            </Button>
          </div>
          <p className="text-muted-foreground">
            Sample data: the catalogue and its prices are made up. Change any
            price before you send.
          </p>

          <p
            aria-live="polite"
            className="flex items-baseline justify-between gap-3 border-t border-border pt-3 font-semibold"
          >
            Total
            <span className="font-heading text-xl tabular-nums">
              {formatUsd(total)}
            </span>
          </p>
        </PanelSection>

        <PanelSection title="Context">
          <Field data-invalid={errors.context ? true : undefined}>
            <FieldLabel htmlFor="context">A note to the lead</FieldLabel>
            <Textarea
              id="context"
              name="context"
              value={context}
              maxLength={2000}
              readOnly={busy}
              aria-invalid={errors.context ? true : undefined}
              aria-describedby={
                errors.context ? "context-error" : "context-hint"
              }
              onChange={(event) => setContext(event.target.value)}
            />
            {!errors.context && (
              <p id="context-hint" className="text-sm text-muted-foreground">
                Shown above the services. Optional.
              </p>
            )}
            <FieldError id="context-error">{errors.context}</FieldError>
          </Field>
        </PanelSection>

        <section aria-label="Actions" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ConfirmDialog
              trigger={
                <Button
                  variant="primary"
                  className={TOUCH}
                  loading={sending}
                  disabled={busy || dirty || Boolean(blocked)}
                >
                  Review and send
                </Button>
              }
              title={`Send this proposal to ${proposal.client.name}?`}
              description={
                <>
                  It goes to{" "}
                  <strong className="font-semibold break-all">
                    {proposal.client.email}
                  </strong>{" "}
                  with {proposal.lineItems.length}{" "}
                  {proposal.lineItems.length === 1 ? "service" : "services"},{" "}
                  <strong className="font-semibold tabular-nums">
                    {formatUsd(proposal.total)}
                  </strong>{" "}
                  in total. Once sent it cannot be edited, and the lead moves to
                  Proposal Sent. Sample data: nothing is sent.
                </>
              }
              confirmLabel="Send proposal"
              onConfirm={send}
            />
            <Button
              type="submit"
              className={TOUCH}
              loading={saving}
              disabled={busy || !dirty || !hydrated}
            >
              Save draft
            </Button>
          </div>
          <WriteFailure
            write={write}
            onRetry={write.variables?.action === "send" ? send : save}
          />
          <HintLine>
            {dirty
              ? "You have changes that are not saved. Save the draft, then review and send it."
              : (blocked ?? "Saved. Review it, then send it to the lead.")}
          </HintLine>
        </section>
      </form>

      <Preview
        client={client}
        lineItems={lineItems.filter((item) => item.service.trim())}
        context={context}
      />
    </div>
  );
}

/** Service, description, price, remove: one line from `nav`, stacked below it. */
const ROW_COLUMNS =
  "nav:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_7.5rem_2rem] nav:items-start nav:gap-x-3";

/**
 * One input of a line item. Its label is visible where the rows stack (below
 * `nav`); from `nav` the column headings show it, and the label stays for
 * assistive technology, naming the line it belongs to.
 */
function RowField({
  label,
  line,
  name,
  value,
  onChange,
  error,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "onChange" | "value" | "id"> & {
  label: string;
  line: number;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <Field data-invalid={error ? true : undefined} className="gap-1.5">
      <FieldLabel htmlFor={id} className="nav:sr-only">
        {label}
        <span className="sr-only">, line {line}</span>
      </FieldLabel>
      <Input
        id={id}
        name={name}
        value={value}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn("read-only:text-muted-foreground", TOUCH, className)}
        {...props}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

// --- sent, viewed, signed, lost --------------------------------------------------

function ReadOnly({
  view,
  proposal,
  write,
}: {
  view: ProposalView;
  proposal: Proposal;
  write: Write;
}) {
  // The stand-in for the proposal service exists only on sample data.
  const canSimulate = useViewer().data?.preview === true;
  const { lead } = view;
  const waiting =
    !lead.exit && (proposal.status === "sent" || proposal.status === "viewed");
  const simulating = write.isPending ? write.variables : undefined;
  const simulate = (event: "viewed" | "signed") =>
    write.mutate({ action: "simulate", event });

  return (
    <div className="grid gap-4 wide:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] wide:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <PanelSection title="Status" aria-live="polite">
          {lead.exit ? (
            <p>
              This lead left the pipeline: {EXIT_LABEL[lead.exit]}. The proposal
              is shown as it was and can no longer be changed.
            </p>
          ) : proposal.status === "signed" ? (
            <>
              <p>
                The lead signed the proposal.{" "}
                <strong className="font-semibold">{lead.name}</strong> is now
                Lead Won, and an invoice draft is waiting for you to check.
              </p>
              <LinkButton
                variant="primary"
                href={invoiceHref(lead.id)}
                className={cn("self-start", TOUCH)}
              >
                Open invoice draft
              </LinkButton>
            </>
          ) : proposal.status === "lost" ? (
            <p>This proposal was lost. It can no longer be changed.</p>
          ) : (
            <p>
              {proposal.status === "viewed"
                ? "The lead has opened the proposal. Waiting for a signature."
                : "Waiting for the lead to view and sign it."}{" "}
              It can no longer be edited.
            </p>
          )}
          {proposal.sentAt && (
            <p className="text-muted-foreground">
              Sent to{" "}
              <span className="break-all">
                {proposal.client.email || proposal.client.name}
              </span>{" "}
              on <LocalTime value={proposal.sentAt} />.
            </p>
          )}
          <WriteFailure
            write={write}
            onRetry={() =>
              write.variables?.action === "simulate" &&
              simulate(write.variables.event)
            }
          />
        </PanelSection>

        {waiting && canSimulate && (
          <PanelSection title="Simulate what the lead does">
            <div className="flex flex-wrap gap-3">
              {proposal.status === "sent" && (
                <Button
                  className={TOUCH}
                  loading={
                    simulating?.action === "simulate" &&
                    simulating.event === "viewed"
                  }
                  disabled={write.isPending}
                  onClick={() => simulate("viewed")}
                >
                  Lead viewed it
                </Button>
              )}
              <Button
                className={TOUCH}
                loading={
                  simulating?.action === "simulate" &&
                  simulating.event === "signed"
                }
                disabled={write.isPending}
                onClick={() => simulate("signed")}
              >
                Lead signed it
              </Button>
            </div>
            <p className="text-muted-foreground">
              Sample data: this stands in for the proposal service reporting
              back.
            </p>
          </PanelSection>
        )}

        <PanelSection title="Client">
          <ClientDetails client={proposal.client} />
        </PanelSection>
      </div>

      <Preview
        client={proposal.client}
        // What the lead was sent, not what the draft later became.
        lineItems={proposal.snapshot ?? proposal.lineItems}
        context={proposal.context}
      />
    </div>
  );
}

// --- the preview -----------------------------------------------------------------

/** The proposal as the lead would read it, drawn here from the draft. */
function Preview({
  client,
  lineItems,
  context,
}: {
  client: ProposalClient;
  lineItems: LineItem[];
  context: string;
}) {
  const priced = lineItems.map((item) => ({
    ...item,
    price: item.price > 0 ? item.price : 0,
  }));
  return (
    <PanelSection
      title="Preview"
      // Stays in view beside a long form; 4rem clears the top bar.
      className="min-w-0 gap-4 wide:sticky wide:top-16"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-xl leading-tight text-balance wrap-break-word">
          Proposal for{" "}
          {client.company.trim() || client.name.trim() || "the client"}
        </h3>
        <p className="wrap-break-word text-muted-foreground">
          Prepared for {client.name.trim() || "the client"}
          {client.email.trim() && `, ${client.email.trim()}`}
        </p>
      </div>
      {context.trim() && (
        <p className="max-w-[65ch] text-pretty wrap-break-word whitespace-pre-line">
          {context.trim()}
        </p>
      )}
      {priced.length === 0 ? (
        <p className="text-muted-foreground">No services yet.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Services and prices</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="pb-2 label-caps">
                Service
              </th>
              <th scope="col" className="pb-2 text-right label-caps">
                Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {priced.map((item, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a read-only list in the order given; two lines may be identical
              <tr key={index} className="align-top">
                <th scope="row" className="py-2 pr-3 font-normal">
                  <span className="block font-semibold wrap-break-word">
                    {item.service}
                  </span>
                  {item.description && (
                    <span className="block text-pretty wrap-break-word text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </th>
                <td className="py-2 text-right whitespace-nowrap tabular-nums">
                  {formatUsd(item.price)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <th scope="row" className="pt-2 font-semibold">
                Total
              </th>
              <td className="pt-2 text-right font-heading text-xl font-semibold tabular-nums">
                {formatUsd(totalOf(priced))}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
      <p className="text-muted-foreground">
        Sample data: drawn here from the proposal. The lead will see the
        proposal service's own layout.
      </p>
    </PanelSection>
  );
}

function BuilderSkeleton() {
  return (
    <output aria-label="Loading proposal" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 wide:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36 rounded-panel" />
          <Skeleton className="h-64 rounded-panel" />
        </div>
        <Skeleton className="h-72 rounded-panel" />
      </div>
    </output>
  );
}
