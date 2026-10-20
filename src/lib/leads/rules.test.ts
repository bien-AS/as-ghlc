import { expect, test } from "vitest";

import {
  effectiveVerdict,
  nextStep,
  statusMeta,
  VERDICT_META,
} from "@/lib/leads/rules";
import { type Booking, type LeadDetail, VERDICTS } from "@/lib/leads/schemas";

test("a Lead Status chip is the status's own value and tone (status_defs); none synced yet is neutral", () => {
  expect(
    statusMeta({ value: "Lost - Spam", group: "Lost", tone: "crit" }),
  ).toEqual({ label: "Lost - Spam", tone: "crit" });
  expect(statusMeta(null)).toEqual({ label: "No status yet", tone: "neutral" });
});

test("every verdict has its word and tone: ok for valid, warn for awaiting, crit for suspect and spam", () => {
  expect(
    Object.fromEntries(VERDICTS.map((v) => [v, VERDICT_META[v].tone])),
  ).toEqual({ valid: "ok", awaiting: "warn", suspect: "crit", spam: "crit" });
  for (const verdict of VERDICTS) {
    expect(VERDICT_META[verdict].label).not.toBe("");
  }
});

test("a rep's review changes the verdict the app acts on; the AI's result is the fallback", () => {
  expect(effectiveVerdict(null)).toBe("awaiting");
  expect(effectiveVerdict({ result: "suspect", reviewOutcome: null })).toBe(
    "suspect",
  );
  expect(
    effectiveVerdict({ result: "suspect", reviewOutcome: "cleared" }),
  ).toBe("valid");
  expect(effectiveVerdict({ result: "suspect", reviewOutcome: "spam" })).toBe(
    "spam",
  );
  expect(effectiveVerdict({ result: "valid", reviewOutcome: null })).toBe(
    "valid",
  );
});

const call = (state: Booking["state"]): Booking => ({
  kind: "discovery",
  time: "2026-10-07T15:00:00.000Z",
  state,
});

type Row = [
  name: string,
  lead: Pick<LeadDetail, "stage" | "exit" | "verdict" | "bookings">,
  main: string | null,
  secondary: string | null,
  hint: string,
];

// The action table in spec 06, row by row.
const table: Row[] = [
  [
    "New lead, awaiting verdict",
    { stage: "new", exit: null, verdict: "awaiting", bookings: [] },
    null,
    null,
    "The AI is still checking this lead. Nothing to do yet.",
  ],
  [
    "New lead, suspect, not reviewed",
    { stage: "new", exit: null, verdict: "suspect", bookings: [] },
    "review",
    null,
    "The AI is unsure about this lead. Decide whether it is genuine.",
  ],
  [
    "New lead, valid or cleared, no call booked",
    { stage: "new", exit: null, verdict: "valid", bookings: [] },
    null,
    null,
    "Waiting for the lead to book a call. Your CRM is following up.",
  ],
  [
    "Discovery Call Booked, call not yet completed",
    {
      stage: "discovery_booked",
      exit: null,
      verdict: "valid",
      bookings: [call("confirmed")],
    },
    "open_deck",
    null,
    "Present the deck on the call. Come back here afterwards to record the outcome.",
  ],
  [
    "Discovery Call Booked, call completed",
    {
      stage: "discovery_booked",
      exit: null,
      verdict: "valid",
      bookings: [call("completed")],
    },
    "qualify",
    "not_qualify",
    "The call is done. Record whether this lead is a fit.",
  ],
  [
    "Qualified",
    { stage: "qualified", exit: null, verdict: "valid", bookings: [] },
    "start_proposal",
    null,
    "Qualified. Build the proposal next.",
  ],
  [
    "Proposal Review Booked",
    { stage: "review_booked", exit: null, verdict: "valid", bookings: [] },
    "finish_proposal",
    null,
    "A review call is booked. Have the proposal ready to send.",
  ],
  [
    "Proposal Sent",
    { stage: "proposal_sent", exit: null, verdict: "valid", bookings: [] },
    null,
    "open_proposal",
    "Proposal sent. Waiting for the lead to view and sign it.",
  ],
  [
    "Lead Won",
    { stage: "won", exit: null, verdict: "valid", bookings: [] },
    "check_invoice",
    null,
    "Signed. Check the invoice draft.",
  ],
];

test.each(table)("%s", (_name, lead, main, secondary, hint) => {
  const step = nextStep(lead);
  expect(step.main).toBe(main);
  expect(step.secondary).toBe(secondary);
  expect(step.hint).toBe(hint);
  // The standing action: spam until won.
  expect(step.canMarkSpam).toBe(lead.stage !== "won");
  expect(step.canReview).toBe(main === "review");
  expect(step.canQualify).toBe(main === "qualify");
});

test.each([
  ["spam", "Spam"],
  ["nurture", "Nurture"],
  ["lost", "Lead Lost"],
] as const)(
  "a lead that left through %s offers no action and says which exit",
  (exit, label) => {
    // Whatever stage it left from (none, for Lead Lost and Nurturing), and whatever the verdict was.
    for (const stage of [null, "new", "discovery_booked", "won"] as const) {
      const step = nextStep({
        stage,
        exit,
        verdict: "suspect",
        bookings: [call("completed")],
      });
      expect(step).toMatchObject({
        main: null,
        secondary: null,
        canReview: false,
        canQualify: false,
        canMarkSpam: false,
      });
      expect(step.hint).toContain(label);
    }
  },
);

test("a lead whose stage has not synced yet waits, with spam the one action", () => {
  expect(
    nextStep({ stage: null, exit: null, verdict: "valid", bookings: [] }),
  ).toMatchObject({
    main: null,
    hint: "Waiting for this lead's stage to sync.",
    canQualify: false,
    canMarkSpam: true,
  });
});

test("a suspect with a call already booked is reviewed before anything else", () => {
  const step = nextStep({
    stage: "discovery_booked",
    exit: null,
    verdict: "suspect",
    bookings: [call("completed")],
  });
  expect(step.main).toBe("review");
  expect(step.canQualify).toBe(false);
});
