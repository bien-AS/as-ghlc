"use client";

import { CostPreview } from "@vantage/design-system";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LocalTime } from "@/components/ui/local-time";
import { Markdown } from "@/components/ui/markdown";
import { PanelSection } from "@/components/ui/panel-section";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import { WritePreview } from "@/components/ui/sync-seam";
import { toast } from "@/components/ui/toast";
import { useRefreshResearch, useResearch } from "@/hooks/use-research";
import { MODEL_INFERENCE } from "@/lib/research/schemas";

const linkClass =
  "rounded-sm wrap-anywhere text-meta text-brand-text underline-offset-4 outline-none hover:underline focus-visible:shadow-focus";

/**
 * The research brief (spec 07): the latest ready brief with its claims and
 * sources. A run in progress or a failed run is said above it; the previous
 * brief stays until a new one is ready.
 */
export function ResearchTab({ leadId }: { leadId: string }) {
  const research = useResearch(leadId);
  const refresh = useRefreshResearch(leadId);

  if (research.isPending) {
    return (
      <output aria-label="Loading research" className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </output>
    );
  }
  if (research.isError) {
    return (
      <ErrorState
        title="The research could not be loaded"
        description="Nothing was changed. Check your connection and try again."
        retrying={research.isFetching}
        onRetry={() => research.refetch()}
      />
    );
  }

  const { brief, run, costEstimate } = research.data;
  const generating = run?.status === "generating" || refresh.isPending;
  const refreshButton = (label: string) => (
    <ConfirmDialog
      tone="neutral"
      trigger={
        <Button loading={refresh.isPending} disabled={generating}>
          {label}
        </Button>
      }
      title="Refresh the research brief?"
      description="Researches this lead again. The current brief stays until the new one is ready."
      confirmLabel="Refresh research"
      onConfirm={() =>
        refresh.mutate(undefined, {
          onError: () =>
            toast.add({
              title: "The research could not be started",
              description: "Nothing was run or charged. Try again.",
              type: "error",
            }),
        })
      }
    >
      <CostPreview
        title="Model cost"
        amount={costEstimate}
        math="The average of recent research runs on the same model."
      />
      <WritePreview>
        <span>Nothing in the CRM. The brief is kept in this app.</span>
      </WritePreview>
    </ConfirmDialog>
  );

  return (
    <>
      {generating && (
        // Run states replace each other with the state library's 150ms fade.
        <output className="flex animate-in items-center gap-2 rounded-md border border-line bg-surface-inset px-3 py-2.5 text-small duration-150 ease-out fade-in">
          <Spinner />
          Researching this lead. The brief updates here when it is ready.
        </output>
      )}
      {run?.status === "failed" && !generating && (
        <Alert
          variant="destructive"
          className="animate-in duration-150 ease-out fade-in"
        >
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>
              The latest research run failed
              {run.error ? `: ${run.error.replace(/\.$/, "")}.` : "."}{" "}
              {brief
                ? "The brief below is the last one that finished."
                : "There is no earlier brief."}
            </span>
            {refreshButton("Try again")}
          </AlertDescription>
        </Alert>
      )}

      {brief ? (
        <PanelSection
          title="Research brief"
          actions={
            run?.status !== "failed" && refreshButton("Refresh research")
          }
        >
          <p className="text-meta text-ink-3">
            Researched <LocalTime value={brief.createdAt} />
            {brief.model && `, ${brief.model}`}, cost{" "}
            {brief.costUsd === null
              ? "not measured"
              : `$${brief.costUsd.toFixed(2)}`}
            .
          </p>
          <Markdown source={brief.briefMd} />
          {brief.facts.claims.length > 0 && (
            <>
              <h3 className="mt-2 label-caps">Claims and sources</h3>
              <ul className="flex flex-col gap-2.5">
                {brief.facts.claims.map((claim) => (
                  <li
                    key={`${claim.claim}-${claim.source}`}
                    className="flex flex-col gap-0.5"
                  >
                    <span className="text-pretty">{claim.claim}</span>
                    {claim.source === MODEL_INFERENCE ? (
                      <span className="text-meta text-ink-3">
                        The model's inference, no source page
                      </span>
                    ) : (
                      <a
                        href={claim.source}
                        target="_blank"
                        rel="noreferrer"
                        className={linkClass}
                      >
                        {claim.source.replace(/^https?:\/\//, "")}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </PanelSection>
      ) : (
        !generating &&
        run?.status !== "failed" && (
          <EmptyState
            variant="empty"
            title="No research yet"
            body="Research runs automatically after intake."
            action={refreshButton("Research now")}
          />
        )
      )}
    </>
  );
}
