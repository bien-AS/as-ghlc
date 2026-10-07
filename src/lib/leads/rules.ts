import type {
  Exit,
  LeadDetail,
  PipelineTab,
  Stage,
  Status,
  Verdict,
} from "@/lib/leads/schemas";

/*
 * The rules every screen and the data-access layer share, so the page and the
 * server cannot disagree: names, the one verdict/status-to-tone mapping
 * (spec 03), the effective verdict (spec 07) and which action a lead offers
 * (spec 06, whose action table is this file's specification). Pure functions;
 * no data access.
 */

export type Tone = "neutral" | "brand" | "ok" | "warn" | "crit";

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New lead",
  discovery_booked: "Discovery Call Booked",
  qualified: "Qualified",
  review_booked: "Proposal Review Booked",
  proposal_sent: "Proposal Sent",
  won: "Lead Won",
};

export const EXIT_LABEL: Record<Exit, string> = {
  spam: "Spam",
  nurture: "Nurture",
  lost: "Lead Lost",
};

export const tabLabel = (tab: PipelineTab): string =>
  tab === "open"
    ? "All open"
    : tab in STAGE_LABEL
      ? STAGE_LABEL[tab as Stage]
      : EXIT_LABEL[tab as Exit];

/** Question 8 (assumed): the status lines, each with its tone. One list. */
export const STATUS_META: Record<Status, { label: string; tone: Tone }> = {
  awaiting_verdict: { label: "Awaiting verdict", tone: "warn" },
  flagged_suspect: { label: "Flagged suspect", tone: "crit" },
  drip_chasing: { label: "Drip chasing the booking", tone: "warn" },
  deck_ready: { label: "Deck ready", tone: "ok" },
  needs_decision: { label: "Needs a decision", tone: "brand" },
  qualified: { label: "Qualified", tone: "ok" },
  proposal_ready: { label: "Proposal ready", tone: "ok" },
  not_a_fit: { label: "Not a fit", tone: "crit" },
  removed: { label: "Removed from pipeline", tone: "crit" },
};

/** Spec 03: ok for valid, warn for awaiting, crit for suspect and spam. */
export const VERDICT_META: Record<Verdict, { label: string; tone: Tone }> = {
  valid: { label: "Valid", tone: "ok" },
  awaiting: { label: "Awaiting", tone: "warn" },
  suspect: { label: "Suspect", tone: "crit" },
  spam: { label: "Spam", tone: "crit" },
};

export const PROPOSAL_LABEL: Record<
  NonNullable<LeadDetail["proposal"]>["status"],
  string
> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  lost: "Lost",
};

export const BOOKING_KIND_LABEL = {
  discovery: "Discovery call",
  proposal_review: "Proposal review",
} as const;

export const BOOKING_STATE_LABEL = {
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
} as const;

/**
 * The verdict the app acts on: the AI's result, adjusted by a rep's review.
 * A cleared suspect is valid everywhere; a rejected one is spam (spec 07).
 */
export function effectiveVerdict(
  record: Pick<
    NonNullable<LeadDetail["verdictRecord"]>,
    "result" | "reviewOutcome"
  > | null,
): Verdict {
  if (!record) return "awaiting";
  if (record.reviewOutcome === "cleared") return "valid";
  if (record.reviewOutcome === "spam") return "spam";
  return record.result;
}

export type LeadAction =
  | "review"
  | "open_deck"
  | "qualify"
  | "not_qualify"
  | "start_proposal"
  | "finish_proposal"
  | "open_proposal"
  | "check_invoice";

export type NextStep = {
  main: LeadAction | null;
  secondary: LeadAction | null;
  /** What to do next and why. */
  hint: string;
  canReview: boolean;
  canQualify: boolean;
  canMarkLost: boolean;
  canMarkSpam: boolean;
};

type ActionInput = Pick<LeadDetail, "stage" | "exit" | "verdict" | "bookings">;

/**
 * Which actions a lead offers and what the hint line says. The page uses it to
 * choose the buttons; the data-access layer uses the same answer to refuse a
 * write the lead's state does not allow.
 */
export function nextStep(lead: ActionInput): NextStep {
  if (lead.exit) {
    return {
      main: null,
      secondary: null,
      hint: `This lead left the pipeline: ${EXIT_LABEL[lead.exit]}.`,
      canReview: false,
      canQualify: false,
      canMarkLost: false,
      canMarkSpam: false,
    };
  }

  const standing = {
    canReview: false,
    canQualify: false,
    canMarkLost: true,
    canMarkSpam: lead.stage !== "won",
  };
  const step = (
    main: LeadAction | null,
    hint: string,
    extra: Partial<NextStep> = {},
  ): NextStep => ({ main, secondary: null, hint, ...standing, ...extra });

  // A verdict that is not settled comes before the stage: a suspect can
  // already have a call booked (question 4, assumed: the booking is kept).
  if (lead.verdict === "awaiting") {
    return step(null, "The AI is still checking this lead. Nothing to do yet.");
  }
  if (lead.verdict === "suspect") {
    return step(
      "review",
      "The AI is unsure about this lead. Decide whether it is genuine.",
      { canReview: true },
    );
  }

  switch (lead.stage) {
    case "new":
      return step(
        null,
        "Waiting for the lead to book a call. Your CRM is following up.",
      );
    case "discovery_booked": {
      const callDone = lead.bookings.some(
        (booking) =>
          booking.kind === "discovery" && booking.state === "completed",
      );
      return callDone
        ? step(
            "qualify",
            "The call is done. Record whether this lead is a fit.",
            { secondary: "not_qualify", canQualify: true },
          )
        : step(
            "open_deck",
            "Present the deck on the call. Come back here afterwards to record the outcome.",
          );
    }
    case "qualified":
      return step("start_proposal", "Qualified. Build the proposal next.");
    case "review_booked":
      return step(
        "finish_proposal",
        "A review call is booked. Have the proposal ready to send.",
      );
    case "proposal_sent":
      // Nothing to do but wait, so no main action; the proposal can be opened.
      return step(
        null,
        "Proposal sent. Waiting for the lead to view and sign it.",
        { secondary: "open_proposal" },
      );
    case "won":
      return step("check_invoice", "Signed. Check the invoice draft.");
  }
}

export const ACTION_LABEL: Record<LeadAction, string> = {
  review: "Review suspect",
  open_deck: "Open deck",
  qualify: "Qualified",
  not_qualify: "Not qualified",
  start_proposal: "Start proposal",
  finish_proposal: "Finish proposal",
  open_proposal: "Open proposal",
  check_invoice: "Check invoice draft",
};
