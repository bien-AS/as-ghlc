---
title: Validation
status: blocked
blocked_by:
  - Lean's export of past form responses
  - question 4
  - question 5
owner_to_ask:
  - Lean
  - Mitchell
build_now: false
---

# 10. Validation

**Purpose:** have the AI research each new lead and return a verdict of valid, suspect or spam, so reps spend time only on genuine leads. It serves reps.

> **Blocked.** This spec stops at the interface. It cannot go further until the items under "What is missing" arrive.

## What is missing, and from whom

| Missing                                                                                                                                                    | From           | Why it blocks                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **An export of past form responses from the CRM.** An action item for Lean from the 5 October meeting; not yet received.                                   | Lean           | The validation prompt and the spam rules are to be derived from real responses. Without them there is nothing to specify or test against. |
| **Question 4:** is a suspect lead's booking cancelled at once or kept until a rep reviews it? Assumed: kept until review.                                  | Lean, Mitchell | Decides what validation does when the result is suspect.                                                                                  |
| **Question 5:** does the app cancel spam bookings itself, or write the verdict and let a CRM workflow react? Assumed: the app does it through the adapter. | Lean           | Decides what validation does when the result is spam.                                                                                     |

## What is known

- The AI research and verdict engine is Claude, through the Anthropic API. Confirmed on 7 October.
- Validation is the only block that calls the AI for verdicts. (Decks also use it, for deck content; that is spec 13.)
- Simple rules can catch obvious spam before the AI runs; the architecture review gives "selling to us" and "job seekers" as examples. The rules themselves are not written.
- For the first customer, the CRM holds a new lead until a verdict is written, then releases it into its sequence.
- A valid verdict leads to a deck being generated (spec 13). A suspect verdict queues the lead for a rep (spec 07). A spam verdict leads to the Spam exit.

## Interface

**Started by:** a new lead arriving from the CRM adapter (spec 11).

**Takes in:** the lead's form answers and website.

**Returns:** a Verdict for the lead: a result (valid, suspect or spam), a summary, and a list of reasons. These are the Verdict fields in the data model sketch (assumed, spec 09).

**Hands on to:** the CRM adapter, to send the verdict out; the lead's timeline, as an activity; Notifications, to raise "Suspect to review" (spec 08).

**Consumed today by:** Pipeline (spec 05), Lead detail (spec 06) and Suspect review (spec 07), which read verdicts from sample data shaped like the above.

Nothing past this line is specified: not the prompt, the research steps, the rules, the thresholds between valid, suspect and spam, retries, costs, or what happens on a suspect or spam result.

## In the current build

Nothing is built. Verdicts on sample leads are written by hand in the fixtures.

## When unblocked

Once the export arrives and questions 4 and 5 are answered, this file is rewritten as a full spec. The handoff's work order places it sixth, "after the export arrives".
