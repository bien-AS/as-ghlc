---
title: Suspect review
status: needs-clarification
blocked_by:
  - question 4
owner_to_ask:
  - Lean
  - Mitchell
build_now: true
---

# 07. Suspect review

**Purpose:** let a rep decide quickly whether a lead the AI was unsure about is genuine or spam. It serves the rep clearing the suspect queue.

> **Needs clarification: question 4.** Is a suspect lead's booking cancelled at once, or kept until a rep reviews it? The 5 October transcript says both that a rep reviews suspects and that suspect bookings are cancelled like spam. This spec is written to the **assumed** answer: **the booking is kept until the rep decides.** Who answers: Lean, Mitchell.
>
> If the answer is "cancelled at once", this screen still exists but changes: a suspect arrives with its booking already cancelled, "Clear as valid" must say that the lead has to book again, and the screen's urgency drops. The parts that would change are marked **(Q4)** below.

## Problem Statement

When the AI returns a suspect verdict, the lead waits for a person. The rep needs the lead's own words and the AI's doubts side by side to decide in seconds, and needs to move straight to the next one. The prototype offered only a verdict box and a Mark spam button inside the lead record, with no queue, no way to say "this one is fine", and no view built for comparing the two.

## Solution

A review screen at `/dashboard/suspects`, inside the shell, reached from the navigation, from the Pipeline's "Suspects to review" count and from a suspect lead's Review suspect action. `/dashboard/suspects/{leadId}` opens the screen on a specific suspect.

### Layout

- **Queue** (left, or above on narrow screens): every lead with a suspect verdict and no review outcome, oldest first, each showing name, company and how long it has waited. A lead with a call booked shows the call's time, and those with a call in the next 24 hours are marked as urgent **(Q4)**. A count heads the queue.
- **Review panel** (the rest): for the selected suspect, two columns of equal weight.
  - **What the lead said:** name, company, email, phone, website (as a link that opens in a new tab), source, budget, and every form answer in the form's order.
  - **Why the AI is unsure:** the verdict box in the suspect tone, with the AI's summary and its reasons as a list.
  - Above both: the booking line. "Call booked for {date and time}. It stays booked until you decide." or "No call booked." **(Q4)**
  - Below both: the two decisions, and a link to the full lead (spec 06).

With no lead id in the address, the oldest suspect is selected.

### The two decisions

| Decision           | What it does                                                                                                                                                                                                                                    | Confirmation                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Clear as valid** | Records the review outcome "cleared" with the reviewer and time. The lead is treated as valid from then on: it stays in its stage, its booking is untouched **(Q4)**, its status becomes that of a valid lead, and an activity is added.        | None                                                       |
| **Mark as spam**   | Records the review outcome "spam" with the reviewer and time. The lead leaves the pipeline through the Spam exit with status "Removed from pipeline", its upcoming booking is marked cancelled (assumed, question 5), and an activity is added. | Yes: names the lead and says the booking will be cancelled |

The AI's original result stays "suspect" on the record; the review outcome is stored beside it. Everywhere else in the app, a cleared suspect is shown and filtered as valid and a rejected one as spam, with the verdict box noting that a person decided.

After either decision the screen moves to the next suspect in the queue, the queue count and the navigation count drop by one, and a brief confirmation names the lead and the decision. Neither decision can be undone from this screen.

A lead that is not an unreviewed suspect cannot be reviewed: opening its address here shows a note saying it has already been decided or is not a suspect, with a link to the lead.

## States

| State                          | What the rep sees                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First load                     | Queue and the first suspect on first paint (prefetched).                                                                                                            |
| Loading                        | When data is not yet available: skeleton queue rows and a skeleton of the two columns.                                                                              |
| Switching suspect              | The queue stays; the review panel shows a skeleton until the selected lead arrives.                                                                                 |
| Empty queue                    | Empty state: "No suspects to review", one sentence saying leads the AI is unsure about appear here, and a link to the Pipeline. No review panel.                    |
| Queue cleared during a session | The same empty state, reached after the last decision, with a line confirming the queue is clear.                                                                   |
| Error loading the queue        | Error state with Try again.                                                                                                                                         |
| Error loading one lead         | The queue stays; the panel shows an error with Try again.                                                                                                           |
| Decision in progress           | The pressed button shows progress; both decisions are disabled; the queue cannot be changed until it settles.                                                       |
| Decision failed                | The lead stays selected and unreviewed; a message offers retry. The queue does not advance.                                                                         |
| Already decided elsewhere      | The decision is refused as a conflict; the screen says someone has already decided this lead, removes it from the queue and moves on.                               |
| Not a suspect                  | The "already decided or not a suspect" note with a link to the lead.                                                                                                |
| No form answers                | "No form answers on this lead." in the left column; the decisions remain available.                                                                                 |
| No reasons                     | The summary alone; if there is no summary either, "The AI gave no reasons."                                                                                         |
| Long content                   | The two columns scroll together as one page so answers and reasons stay side by side; the decisions stay reachable without scrolling back.                          |
| Narrow screens                 | Below 1080px the queue becomes a compact selector above the panel; below 720px the two columns stack, lead's answers first, with the decisions fixed at the bottom. |

## Data

| Entity   | Read                                                                                    | Written                                                                   |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Lead     | name, company, email, phone, website, source, budget, form answers, stage, created time | exit and status on Mark as spam; status on Clear as valid                 |
| Verdict  | result, summary, reasons, review outcome                                                | review outcome (cleared or spam), reviewed by (current user), reviewed at |
| Booking  | kind, time, state                                                                       | state set to cancelled on Mark as spam (assumed, question 5)              |
| Activity | Not shown here                                                                          | One entry per decision, with the current user as actor                    |
| User     | Current user, as reviewer and actor                                                     | Nothing                                                                   |

The queue reads `GET /api/leads` filtered to suspects awaiting review; the panel reads `GET /api/leads/{leadId}`; decisions go through `POST /api/leads/{leadId}/review` (spec 04). In this build all of it is sample data and decisions are not durable.

## Assumptions

- **Question 4:** a suspect's booking is kept until a rep reviews it. Assumed. Everything marked (Q4) depends on it.
- **Question 5:** on Mark as spam the app cancels the booking through the adapter. Assumed. In this build only the sample booking's state changes; nothing is sent to a CRM or to the lead. The polite note mentioned in the handoff is not sent from here.
- **Question 7:** any authenticated user can review any suspect. Under the proposed roles, staff would review only suspects assigned to them.
- **Question 8:** after Clear as valid the lead takes the status a valid lead would have: "Drip chasing the booking" when no call is booked. The assumed status list has no value for "valid, call booked, deck not yet generated"; in this build "Needs a decision" stands in for it. This gap is for Lean to settle with the status list.
- **Question 2 (indirect):** clearing a suspect should lead to a deck being generated, as for any valid lead. Deck generation is blocked and does not happen in this build.
- Oldest-first ordering with booked-soon suspects marked urgent is proposed.
- Keeping the AI's result and storing the review outcome beside it follows the Verdict entity in the data model sketch, whose fields are assumed.
- No undo is proposed. A wrong decision is corrected from Lead detail only in the direction valid to spam (Mark spam); spam to valid has no path yet.

## Acceptance checks

1. `/dashboard/suspects` lists exactly the sample leads whose verdict is suspect with no review outcome, oldest first, with a count that matches the navigation and the Pipeline's "Suspects to review".
2. The selected suspect shows form answers and contact details in one column and the AI's summary and reasons in the other, side by side at 1280px.
3. A suspect with a call booked shows the call time and the "stays booked until you decide" line; one without shows "No call booked."
4. Clear as valid, with no confirmation, removes the lead from the queue, selects the next one, and lowers all three counts by one. Opening that lead's detail shows it as valid, reviewed by the signed-in user, with its booking unchanged and a new timeline entry.
5. Mark as spam asks for confirmation naming the lead. Confirming removes the lead from the queue; its detail page shows the Spam exit, a cancelled booking, the reviewer and a new timeline entry. Cancelling the confirmation changes nothing.
6. Clearing the last suspect shows the empty state.
7. Opening `/dashboard/suspects/{leadId}` for a lead that is valid, spam or already reviewed shows the "already decided or not a suspect" note and no decision buttons.
8. Sending a review for an already-reviewed lead directly to the API is refused as a conflict and changes nothing.
9. Forcing the decision request to fail leaves the lead in the queue, unreviewed, with a retry offered.
10. Both decisions are disabled while one is in progress; pressing twice records one decision.
11. No text on the screen names a CRM.
12. Both decisions are reachable and operable by keyboard; after a decision, focus lands on the next suspect's heading.
13. At 700px wide the columns stack with the lead's answers first and the decisions always reachable.

## User Stories

1. As a rep, I want a queue of suspect leads, so that I can clear them in one sitting.
2. As a rep, I want to know how many suspects are waiting, so that I can plan my time.
3. As a rep, I want the oldest suspect first, so that nobody waits longest by accident.
4. As a rep, I want suspects with a call coming up soon marked, so that I decide before the call.
5. As a rep, I want the lead's form answers beside the AI's reasons, so that I can compare them without switching views.
6. As a rep, I want the AI's summary, so that I get the gist before the detail.
7. As a rep, I want each reason listed separately, so that I can check them one by one.
8. As a rep, I want to open the lead's website from the review, so that I can look for myself.
9. As a rep, I want to see whether a call is booked, so that I know what my decision affects.
10. As a rep, I want to be told the booking is kept until I decide, so that I am not worried about a lost call.
11. As a rep, I want to clear a lead as valid in one click, so that genuine leads are not held up.
12. As a rep, I want to mark a lead as spam, so that it leaves my pipeline.
13. As a rep, I want a confirmation before spam, so that I do not cancel a real lead's call by mistake.
14. As a rep, I want the next suspect to appear after I decide, so that I keep my pace.
15. As a rep, I want a brief confirmation of what I just decided, so that I can catch a slip.
16. As a rep, I want to open the full lead from the review, so that I can dig deeper when unsure.
17. As a rep, I want to open one specific suspect by link, so that a colleague can ask me about it.
18. As a rep, I want to be told when the queue is empty, so that I know I am done.
19. As a rep, I want to be told if someone else already decided a lead, so that we do not both act.
20. As a rep, I want a retry when a decision fails, so that I am not unsure whether it was recorded.
21. As a team lead, I want each decision to record who made it and when, so that reviews are accountable.
22. As a rep, I want a cleared lead shown as valid everywhere, so that it is treated like any other good lead.
23. As a rep, I want the record to keep that the AI was unsure, so that the history is honest.
24. As a rep on a small screen, I want the decisions always in reach, so that I can review from a laptop on a call.
25. As a keyboard user, I want to move through the queue and decide without a mouse, so that I can go fast.
26. As a rep, I never want to see which CRM is behind the app.
27. As the project lead, I want the parts that depend on question 4 marked, so that the answer can be applied quickly.

## Implementation Decisions

- The screen lives inside the shell at `/dashboard/suspects` with an optional lead id segment. Its Server Component prefetches the queue and the selected lead (ADR-0001).
- It reuses spec 04's lead list resource with the "suspects to review" category and oldest-first order, and the lead detail resource. It adds one mutation, the review, with input "cleared" or "spam".
- The review mutation returns the updated lead. On success the queue, the pipeline summary (which feeds the navigation count and the Pipeline strip) and that lead's detail are invalidated.
- No optimistic update: the queue advances after the server confirms. The next suspect's detail is prefetched while the rep reads the current one, so advancing is immediate.
- The rule "this lead can be reviewed" (suspect result, no review outcome, still in the pipeline) is part of the shared available-action function from spec 06, and is enforced in the data-access layer, which refuses anything else with the conflict error.
- The effects of each decision (review outcome, reviewer, status, exit, booking state, activity) are applied together in the data-access layer.
- Everything that depends on question 4 sits behind one named rule in the data-access layer ("a suspect's booking is kept until review"), so the other answer is a change in one place plus the marked copy.
- The effective verdict (the AI's result adjusted by the review outcome) is computed in the data-access layer and is what the list's verdict filter and every verdict chip use.
- The verdict box and layout come from spec 03. The spam confirmation is the same dialog used in spec 06.
- No keyboard shortcuts beyond normal focus order in this build.

## Testing Decisions

_Seams confirmed by the owner: data-access functions and Route Handlers through their public behaviour with Vitest; pages through Testing Library at page level; no end-to-end browser suite yet._

- A good test gives a suspect in a known state, makes a decision and checks what the lead, its verdict, its booking and its timeline look like afterwards.
- **Data-access function** (review suspect), with Vitest: cleared keeps the booking and makes the lead valid everywhere; spam exits the lead and cancels the booking; reviewer and time are recorded from the current user, never from input; a non-suspect, an already-reviewed lead and an exited lead are each refused; the queue query excludes reviewed leads.
- **Route Handler**, with Vitest: only "cleared" and "spam" are accepted; conflict and not-found responses.
- **Screen**, with Testing Library: the two columns render from a lead; the booking line in both cases; the spam confirmation; advancing after a decision; the empty state; the conflict and failure states.
- No end-to-end browser suite yet.
- Prior art: none in the repo.

## Out of Scope

- Running validation or producing verdicts (spec 10). Verdicts here come from sample data.
- Cancelling a real booking, removing a lead in a CRM, or sending anything to the lead (spec 11, question 5).
- Generating a deck after a lead is cleared (spec 13).
- Undoing a decision; changing spam back to valid.
- Bulk decisions.
- Assigning suspects to particular reps; per-role queues (spec 12).
- Feedback to the AI from a rep's decision.
- A notification when a suspect arrives (spec 08).

## Further Notes

- The architecture review marks this use case with question 4 and draws "if marked spam" leading to "Cancel a spam booking", itself marked with question 5. Both markers are carried here.
- Simple rules that catch obvious spam before the AI runs (mentioned in the handoff) would reduce this queue; they belong to spec 10.
