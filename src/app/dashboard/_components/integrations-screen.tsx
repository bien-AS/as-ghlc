"use client";

import { useId, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { LocalTime } from "@/components/ui/local-time";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { PanelSection } from "@/components/ui/panel-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, NotAllowedState } from "@/components/ui/state-panel";
import { toast } from "@/components/ui/toast";
import {
  useConnect,
  useConnections,
  useDisconnect,
  useImportLeads,
  useSaveStageMapping,
  useSyncNow,
} from "@/hooks/use-connections";
import { useHydrated } from "@/hooks/use-hydrated";
import { ApiError } from "@/lib/api/client";
import { CRM_PROVIDERS } from "@/lib/connections/providers";
import {
  AVAILABILITY_META,
  CONNECTION_STATUS_META,
  CONNECTION_TYPE_LABEL,
  providerIsFixed,
  stageDirectionText,
} from "@/lib/connections/rules";
import {
  type Connection,
  connectInputSchema,
  type StageMapping,
  stageMappingInputSchema,
} from "@/lib/connections/schemas";
import { clearErrorOnEdit, type FieldErrors, readForm } from "@/lib/forms";
import { STAGE_LABEL } from "@/lib/leads/rules";
import { STAGES } from "@/lib/leads/schemas";

import { PIPELINE_HREF } from "../navigation";

/** The 44px Touch Rule: taller below `nav` and on a coarse pointer. */
const TOUCH = "max-nav:min-h-11 pointer-coarse:min-h-11";

const muted = "max-w-[65ch] text-pretty text-muted-foreground";

/** What a refused or failed write says. A 409 means the Connection changed elsewhere. */
function WriteFailure({ error }: { error: unknown }) {
  const changed = error instanceof ApiError && error.status === 409;
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {changed
          ? "This Connection changed since you opened the page, so nothing was done. The latest is shown."
          : "That did not go through. Nothing was changed. Try again."}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Integrations (spec 16, split from Workspace settings by owner decision): the
 * Workspace's Connections, one panel per type. For admins and owners; the
 * server refuses everyone else, and this only says so. The one screen that
 * names providers by brand, and every name comes from the provider table.
 */
export function IntegrationsScreen({
  notAllowed = false,
}: {
  /** The server already refused this viewer's role. */
  notAllowed?: boolean;
}) {
  const connections = useConnections(!notAllowed);

  const header = (
    <PageHeader
      title="Integrations"
      description="The services this Workspace is connected to. Each one is a Connection."
    />
  );

  const refused =
    notAllowed ||
    (connections.error instanceof ApiError &&
      connections.error.code === "forbidden");
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
  if (connections.isPending) {
    return (
      <>
        {header}
        <IntegrationsSkeleton />
      </>
    );
  }
  if (connections.isError && !connections.data) {
    return (
      <>
        {header}
        <ErrorState
          title="The Connections could not be loaded"
          description="Nothing was changed. Check your connection and try again."
          retrying={connections.isFetching}
          onRetry={() => connections.refetch()}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="flex w-full max-w-3xl flex-col gap-4">
        {connections.data.map((connection) => (
          <ConnectionPanel key={connection.type} connection={connection} />
        ))}
      </div>
    </>
  );
}

/** One Connection: what it is, how it stands, and what can be done with it. */
function ConnectionPanel({ connection }: { connection: Connection }) {
  const { type, provider } = connection;
  const isCrm = type === "crm";
  const sync = useSyncNow();
  const disconnect = useDisconnect();
  const hydrated = useHydrated();

  const connected = connection.status !== "not_connected";
  // "Syncing" lasts exactly as long as the request does.
  const status = sync.isPending ? "syncing" : connection.status;
  const meta = CONNECTION_STATUS_META[status];
  const label = CONNECTION_TYPE_LABEL[type];
  const failure = sync.error ?? disconnect.error;

  return (
    <PanelSection
      title={label}
      aria-label={label}
      actions={
        connected && (
          <div className="flex flex-wrap items-center gap-3">
            {isCrm && (
              // The screen's one primary action while the CRM is connected.
              <Button
                variant="primary"
                className={TOUCH}
                loading={sync.isPending}
                disabled={!hydrated || disconnect.isPending}
                onClick={() => {
                  disconnect.reset();
                  sync.mutate("crm");
                }}
              >
                Sync now
              </Button>
            )}
            <ConfirmDialog
              trigger={
                <Button
                  className={TOUCH}
                  loading={disconnect.isPending}
                  disabled={!hydrated || sync.isPending}
                  // Up to four of these on the screen: each says what it disconnects.
                  aria-label={`Disconnect ${provider.name}`}
                >
                  Disconnect
                </Button>
              }
              title={`Disconnect ${provider.name}?`}
              description={
                isCrm
                  ? "Leads stop arriving from it and changes stop being pushed out to it. Leads already in Dealwright stay. You can connect it again with its API key."
                  : "Dealwright stops using it until you connect it again with its API key."
              }
              confirmLabel="Disconnect"
              onConfirm={() => {
                sync.reset();
                disconnect.mutate(type, {
                  onSuccess: () =>
                    toast.add({
                      title: `Disconnected ${provider.name}`,
                      type: "success",
                    }),
                });
              }}
            />
          </div>
        )
      }
    >
      <p
        aria-live="polite"
        className="flex flex-wrap items-center gap-x-3 gap-y-1"
      >
        <span className="font-heading text-base font-semibold">
          {provider.name}
        </span>
        <Badge variant={meta.tone}>{meta.label}</Badge>
        {connected && (
          <span className="text-muted-foreground">
            {connection.lastSyncedAt ? (
              <>
                Last synced <LocalTime value={connection.lastSyncedAt} />
              </>
            ) : (
              "Not synced yet"
            )}
          </span>
        )}
      </p>
      {providerIsFixed(type) && (
        <p className={muted}>This service is fixed in the first version.</p>
      )}
      {failure && <WriteFailure error={failure} />}

      {!connected && <ConnectForm connection={connection} primary={isCrm} />}
      {isCrm && connection.stageMapping && (
        <>
          <ImportLeads providerName={provider.name} />
          <StageMappingForm
            stageMapping={connection.stageMapping}
            providerName={provider.name}
          />
        </>
      )}
      {isCrm && <CrmProviders />}
    </PanelSection>
  );
}

const blockClass = "flex flex-col gap-3 border-t border-border pt-3";

/**
 * MOCK connect. The key is checked as non-empty, sent once and dropped by the
 * server; it is not kept in this component's state either.
 */
function ConnectForm({
  connection: { type, provider },
  primary,
}: {
  connection: Connection;
  /** True for the CRM: its Connect is then the screen's one primary action. */
  primary: boolean;
}) {
  const connect = useConnect();
  const hydrated = useHydrated();
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <form
      // Never GET: a submit the browser handles itself must not put the key in the address.
      method="post"
      noValidate
      autoComplete="off"
      aria-busy={connect.isPending}
      className={blockClass}
      onChange={clearErrorOnEdit(setErrors)}
      onSubmit={(event) => {
        event.preventDefault();
        if (connect.isPending) return;
        const { data, errors: found } = readForm(
          connectInputSchema,
          event.currentTarget,
        );
        setErrors(found ?? {});
        if (!data) return;
        connect.mutate(
          { type, input: data },
          {
            onSuccess: () =>
              toast.add({
                title: `Connected ${provider.name}`,
                type: "success",
              }),
          },
        );
      }}
    >
      {connect.isError && <WriteFailure error={connect.error} />}
      <FormField
        label={`${provider.name} API key`}
        name="apiKey"
        type="password"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        error={errors.apiKey}
        readOnly={connect.isPending}
        required
        className={TOUCH}
      />
      <p className={muted}>
        Sample data: the key is not stored and nothing is contacted.
      </p>
      <Button
        type="submit"
        variant={primary ? "primary" : undefined}
        className={`self-start ${TOUCH}`}
        loading={connect.isPending}
        disabled={!hydrated}
        aria-label={`Connect ${provider.name}`}
      >
        Connect
      </Button>
    </form>
  );
}

/** Runs an import and says what it did, as a plain line. */
function ImportLeads({ providerName }: { providerName: string }) {
  const run = useImportLeads();
  const hydrated = useHydrated();
  const result = run.data;

  return (
    <div className={blockClass}>
      <h3 className="text-sm">Import leads</h3>
      <p className={muted}>
        Brings the leads already in {providerName} into Dealwright. A lead that
        is already here is not added a second time, so an import can be run
        again safely.
      </p>
      {run.isError && <WriteFailure error={run.error} />}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          className={TOUCH}
          loading={run.isPending}
          disabled={!hydrated}
          onClick={() => run.mutate()}
        >
          Import leads
        </Button>
        <output className="tabular-nums">
          {result &&
            `Import finished: ${result.found} found, ${result.added} added, ${result.alreadyHere} already here.`}
        </output>
      </div>
      <p className={muted}>
        Sample data: nothing is contacted. Every sample lead is already here.
      </p>
    </div>
  );
}

/** The app's six stages, each with the CRM stage it becomes. Stacked rows below `nav`. */
function StageMappingForm({
  stageMapping,
  providerName,
}: {
  stageMapping: StageMapping;
  providerName: string;
}) {
  const save = useSaveStageMapping();
  const hydrated = useHydrated();
  const id = useId();

  return (
    <form
      method="post"
      aria-busy={save.isPending}
      className={blockClass}
      onSubmit={(event) => {
        event.preventDefault();
        if (save.isPending) return;
        const { data } = readForm(stageMappingInputSchema, event.currentTarget);
        if (!data) return;
        save.mutate(data, {
          onSuccess: () =>
            toast.add({ title: "Stage mapping saved", type: "success" }),
        });
      }}
    >
      <h3 className="text-sm">Map stages</h3>
      <p className={muted}>{stageDirectionText(providerName)}</p>
      <div className="flex flex-col">
        {/* Column headings from `nav` up; below it each label sits over its select. */}
        <div
          aria-hidden="true"
          className="hidden grid-cols-2 gap-3 pb-2 font-semibold text-muted-foreground nav:grid"
        >
          <span>Stage in Dealwright</span>
          <span>Stage in {providerName}</span>
        </div>
        {STAGES.map((stage) => (
          <div
            key={stage}
            className="grid gap-1.5 border-t border-border py-2 nav:grid-cols-2 nav:items-center nav:gap-3"
          >
            <Label htmlFor={`${id}-${stage}`}>{STAGE_LABEL[stage]}</Label>
            <NativeSelect
              id={`${id}-${stage}`}
              name={stage}
              defaultValue={stageMapping.mapping[stage]}
              disabled={save.isPending}
              className="w-full max-nav:[&_select]:h-11 pointer-coarse:[&_select]:h-11"
            >
              {stageMapping.crmStages.map((name) => (
                <NativeSelectOption key={name} value={name}>
                  {name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))}
      </div>
      {save.isError && <WriteFailure error={save.error} />}
      <Button
        type="submit"
        className={`self-start ${TOUCH}`}
        loading={save.isPending}
        disabled={!hydrated}
      >
        Save stage mapping
      </Button>
    </form>
  );
}

/** Which CRMs can be connected (question 11): the list is the provider table. */
function CrmProviders() {
  return (
    <div className={blockClass}>
      <h3 className="text-sm">CRMs Dealwright connects to</h3>
      <ul className="flex flex-col gap-2">
        {CRM_PROVIDERS.map((provider) => {
          const meta = AVAILABILITY_META[provider.availability];
          return (
            <li key={provider.id} className="flex items-center gap-3">
              <span>{provider.name}</span>
              <Badge variant={meta.tone}>{meta.label}</Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IntegrationsSkeleton() {
  return (
    <output
      aria-label="Loading Connections"
      className="flex w-full max-w-3xl flex-col gap-4"
    >
      <Skeleton className="h-96 rounded-panel" />
      <Skeleton className="h-28 rounded-panel" />
      <Skeleton className="h-28 rounded-panel" />
      <Skeleton className="h-28 rounded-panel" />
    </output>
  );
}
