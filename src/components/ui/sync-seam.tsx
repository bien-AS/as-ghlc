"use client";

import { type AuditState, StatusPill } from "@vantage/design-system";
import { RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { LocalTime } from "@/components/ui/local-time";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SyncEntry } from "@/lib/leads/schemas";
import { cn } from "@/lib/utils";

/*
 * The seam (spec 06): what the app wrote to the CRM for a lead, when, and how
 * it went. Rep-facing, so the CRM is never named by brand. The lead list shows
 * the latest write per row; lead detail lists every write; each mutating modal
 * names the write before it happens (`WritePreview`).
 */

type WriteType = SyncEntry["writeType"];
type WriteResult = SyncEntry["result"];

/** Each write in words: its name, and what it changes in the CRM. */
export const WRITE_WORDS: Record<WriteType, { label: string; sets: string }> = {
  w1_verdict: {
    label: "Validation verdict",
    sets: "Validation Status and Validation Summary on the contact",
  },
  w2_deck_link: { label: "Deck link", sets: "the deck link on the contact" },
  w3_qualification: {
    label: "Qualification decision",
    sets: "Qualification Decision on the opportunity, and its stage",
  },
  w4_mark_spam: {
    label: "Marked as spam",
    sets: "Validation Status to Spam on the contact",
  },
  w5_proposal_sent: {
    label: "Proposal sent",
    sets: "the proposal link on the contact, and the stage",
  },
  w6_proposal_signed: {
    label: "Proposal signed",
    sets: "the opportunity's stage to Lead Won",
  },
};

/** Skipped is grey, never the red of a failure: nothing was sent. */
const RESULT: Record<WriteResult, { state: AuditState; label: string }> = {
  succeeded: { state: "pass", label: "Written" },
  failed: { state: "fail", label: "Failed" },
  skipped: { state: "unknown", label: "Skipped" },
  pending: { state: "unknown", label: "Pending" },
};

/** Why a write did not land, in words. */
export function whyNot(entry: SyncEntry): string | null {
  if (entry.result === "skipped") {
    return entry.lastError === "writes disabled"
      ? "Writes to the CRM are off, so nothing was sent."
      : (entry.lastError ?? "Nothing was sent.");
  }
  if (entry.result === "failed")
    return entry.lastError ?? "The CRM refused it.";
  return null;
}

/** What a confirmed write did, for the toast after the modal closes. */
export function writeOutcome(entry: SyncEntry | undefined): {
  description: string;
  failed: boolean;
} {
  if (!entry) {
    return { description: "Nothing was written to the CRM.", failed: false };
  }
  const { label } = WRITE_WORDS[entry.writeType];
  switch (entry.result) {
    case "succeeded":
      return { description: `${label}: written to the CRM.`, failed: false };
    case "pending":
      return { description: `${label}: still being written.`, failed: false };
    case "skipped":
      return {
        description: `${label} was skipped. ${whyNot(entry)}`,
        failed: false,
      };
    case "failed":
      return {
        description: `${label} failed: ${whyNot(entry)} It stays on the lead's seam until it is retried.`,
        failed: true,
      };
  }
}

/** The line every mutating modal shows: the write it will cause, in words. */
export function WritePreview({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="write-preview"
      className={cn(
        "flex flex-col gap-1 rounded-md border border-line bg-surface-inset px-3 py-2.5 text-meta text-pretty text-ink-2",
        className,
      )}
    >
      <span className="label-caps">What this changes</span>
      {children}
    </div>
  );
}

/**
 * A list row's last write to the CRM: an icon whose hover and focus say which
 * write, when and how it went. For an admin it opens the sync log.
 */
export function SyncIndicator({
  entry,
  href,
}: {
  entry: SyncEntry | null;
  /** The sync log, when the viewer may open it. */
  href?: string;
}) {
  const result = entry ? RESULT[entry.result] : null;
  const summary = entry
    ? `${WRITE_WORDS[entry.writeType].label}: ${result?.label.toLowerCase()}`
    : "Nothing written to the CRM yet";
  const tone = !entry
    ? "text-ink-4"
    : entry.result === "failed"
      ? "text-danger-ink"
      : entry.result === "succeeded"
        ? "text-teal-ink"
        : "text-ink-3";
  const trigger = cn(
    "inline-flex size-7 items-center justify-center rounded-md outline-none transition-colors duration-150 ease-out focus-visible:shadow-focus",
    tone,
    href && "hover:bg-surface-hover",
  );
  const icon = <RefreshCwIcon aria-hidden="true" className="size-3.5" />;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          href ? (
            <Link
              href={href}
              aria-label={`${summary}. Open the sync log`}
              className={trigger}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the tooltip is the content; keyboards reach it by focus
            <span tabIndex={0} aria-label={summary} className={trigger} />
          )
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-0.5 text-left">
        <span className="font-semibold">{summary}</span>
        {entry && (
          <>
            <LocalTime value={entry.time} />
            {whyNot(entry) && <span>{whyNot(entry)}</span>}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Every write to the CRM for one lead, newest first: the detail page's seam. */
export function SeamList({ entries }: { entries: SyncEntry[] }) {
  // The writes already there on first paint stay still; one that arrives after
  // a confirmed action settles in, so the eye finds what the modal promised.
  const [onFirstPaint] = useState(
    () => new Set(entries.map((entry) => entry.id)),
  );
  if (entries.length === 0) {
    return (
      <p className="text-meta text-pretty text-ink-3">
        Nothing has been written to the CRM for this lead yet.
      </p>
    );
  }
  return (
    <ol aria-label="Writes to the CRM" className="flex flex-col gap-3">
      {entries.map((entry) => {
        const result = RESULT[entry.result];
        const why = whyNot(entry);
        return (
          <li
            key={entry.id}
            className={cn(
              "flex flex-col gap-1",
              // 200ms, opacity and 4px; the global reduced-motion rule makes it instant.
              !onFirstPaint.has(entry.id) &&
                "animate-in duration-200 ease-out fade-in slide-in-from-top-1",
            )}
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-small font-semibold text-ink">
                {WRITE_WORDS[entry.writeType].label}
              </span>
              <StatusPill state={result.state} label={result.label} size="sm" />
            </span>
            <LocalTime
              value={entry.time}
              className="text-meta text-ink-3 tabular-nums"
            />
            {why && (
              <span className="text-meta text-pretty text-ink-2">{why}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
