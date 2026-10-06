---
title: Lead detail page
status: ready
blocked_by: []
owner_to_ask: []
build_now: true
---

# 06. Lead detail page

**Purpose:** show everything about one lead and offer the one thing the rep should do next. It serves the rep working that lead.

## Problem Statement

To work a lead, a rep needs its contact details, what it said on the form, whether the AI trusts it and why, what has been booked, where the deck, proposal and invoice stand, and what has happened so far. The prototype showed part of this in one panel with five buttons always visible, two of which no longer apply, and logged its writes in a panel that named the CRM. A rep could not tell which button mattered at this moment.

## Solution

One page at `/dashboard/leads/{leadId}`, inside the shell. On wide screens it uses the three-column layout from spec 03; the order below is the reading order when the columns collapse.

### 1. Header

- A link back to the Pipeline, returning to the rep's previous filters.
- The lead's name and company.
- Chips: stage (or the exit, if the lead has left the pipeline), status, verdict, owner, and proposal status when a proposal exists.

### 2. Actions and hint line

One **main action** that depends on where the lead is, up to one secondary action beside it, and two standing actions: **Mark lost** and **Mark spam**. Under the buttons, one **hint line** says what to do next and why.

| Lead is in                                    | Main action                        | Secondary     | Hint line says                                                                 |
| --------------------------------------------- | ---------------------------------- | ------------- | ------------------------------------------------------------------------------ |
| New lead, awaiting verdict                    | None                               | None          | The AI is still checking this lead. Nothing to do yet.                         |
| New lead, suspect, not reviewed               | **Review suspect** (opens spec 07) | None          | The AI is unsure about this lead. Decide whether it is genuine.                |
| New lead, valid or cleared, no call booked    | None                               | None          | Waiting for the lead to book a call. Your CRM is following up.                 |
| Discovery Call Booked, call not yet completed | **Open deck**                      | None          | Present the deck on the call. Come back here afterwards to record the outcome. |
| Discovery Call Booked, call completed         | **Qualified**                      | Not qualified | The call is done. Record whether this lead is a fit.                           |
| Qualified                                     | **Start proposal**                 | None          | Qualified. Build the proposal next.                                            |
| Proposal Review Booked                        | **Finish proposal**                | None          | A review call is booked. Have the proposal ready to send.                      |
| Proposal Sent                                 | None                               | None          | Proposal sent. Waiting for the lead to view and sign it.                       |
| Lead Won                                      | **Check invoice draft**            | None          | Signed. Check the invoice draft.                                               |
| Any exit (Spam, Nurture, Lead Lost)           | None                               | None          | Says which exit, when and why. No actions are offered.                         |

In this build, **Open deck**, **Start proposal**, **Finish proposal** and **Check invoice draft** lead to parts of the product that are not built. Open deck goes to the deck presenter placeholder; Start proposal and Finish proposal go to the proposal builder placeholder (spec 04). Check invoice draft has no destination yet: the button is shown disabled and the hint line says invoice drafts are not available yet.

**Actions that change the lead in this build:**

- **Qualified** moves the lead to the Qualified stage with status "Qualified" and adds an activity.
- **Not qualified** asks for confirmation, then moves the lead to the Lead Lost exit with status "Not a fit" and adds an activity.
- **Mark lost** asks for confirmation with an optional reason, then moves the lead to the Lead Lost exit with status "Removed from pipeline" and adds an activity carrying the reason. Offered while the lead is in the pipeline.
- **Mark spam** asks for confirmation, then moves the lead to the Spam exit with status "Removed from pipeline", marks any upcoming booking cancelled (assumed, question 5) and adds an activity. Offered while the lead is in the pipeline and has not won.

Mark lost and Mark spam are danger-style buttons, visually apart from the main action. Once a lead has left the pipeline there is no action to bring it back.

### 3. Details

A labelled list: email, phone, website, source, budget, next call (kind, date, time and booking state, or "No call booked"), deck, proposal, invoice. Email, phone and website are links. A missing value shows a dash, never an empty row.

### 4. Form answers

The questions the lead answered on the form and their answers, in the form's order.

### 5. Verdict box

Toned by verdict (spec 03). Shows the verdict word, the AI's summary and its list of reasons. When a rep has reviewed a suspect, the box also shows the outcome, who decided and when. When the lead is awaiting a verdict, the box says so and shows no reasons.

### 6. Deck, proposal and invoice

Three small status panels.

- **Deck:** "Not generated yet", or the template name with links to view and to the PDF.
- **Proposal:** "Not started", or its status: draft, sent, viewed, signed, lost.
- **Invoice:** "No invoice yet", or its status.

In this build these show whatever the sample lead carries. Each panel that depends on an unbuilt part of the product carries a short "Not available yet" note instead of dead buttons.

### 7. Activity timeline

Every activity on the lead, newest first: who or what acted (a user by name, "System", or "CRM"), what happened, and when. This replaces the prototype's log of CRM writes. Actions taken on this page appear at the top as soon as they succeed.

### Changes from the prototype

- "Generate presentation" is removed. Decks generate on their own for valid leads.
- "Get proposal link" is replaced by the entry to the proposal builder.
- The write log becomes the activity timeline.
- The hint line is kept.
- No text names the CRM. Where the CRM acts, the page says "CRM" or "your CRM".
- "Atomic Slides" does not appear.

## States

| State                    | What the rep sees                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First load               | Data on first paint (prefetched).                                                                                                                                      |
| Loading                  | When data is not yet available: skeletons shaped like the header, action row, details list, verdict box and timeline.                                                  |
| Lead not found           | A panel saying the lead does not exist or has been removed, with a link back to the Pipeline. Not the error state.                                                     |
| Error loading            | Error state with Try again and a link back to the Pipeline.                                                                                                            |
| Action in progress       | The pressed button shows progress; all actions on the page are disabled until it settles.                                                                              |
| Action succeeded         | Chips, actions, hint line and timeline update together. A brief confirmation names what was done.                                                                      |
| Action failed            | The lead is unchanged. A message says the action did not go through, with the choice to retry.                                                                         |
| Action no longer allowed | If the lead changed elsewhere, the action is refused, the page reloads the lead and says it had changed.                                                               |
| Confirmation             | Not qualified, Mark lost and Mark spam each open a confirmation that names the lead and the consequence. Cancel changes nothing. Focus returns to the button on close. |
| Empty: no form answers   | "No form answers on this lead."                                                                                                                                        |
| Empty: no verdict        | The awaiting-verdict box.                                                                                                                                              |
| Empty: no bookings       | "No call booked."                                                                                                                                                      |
| Empty: no timeline       | "Nothing has happened on this lead yet."                                                                                                                               |
| Exited lead              | Name struck through, exit chip, no actions, hint line explains.                                                                                                        |
| Long content             | Long answers and reasons wrap; a long timeline shows the newest 20 with "Show earlier".                                                                                |
| Narrow screens           | One column in the order above; actions stay directly under the header.                                                                                                 |

## Data

| Entity   | Read                                                                                                       | Written                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Lead     | name, company, email, phone, website, source, budget, form answers, owner, stage, exit, status, timestamps | stage, exit, status (Qualified, Not qualified, Mark lost, Mark spam) |
| Verdict  | result, summary, reasons, reviewed by, review outcome                                                      | Nothing here (spec 07 writes the review)                             |
| Booking  | kind, time, state                                                                                          | state set to cancelled on Mark spam (assumed, question 5)            |
| Deck     | template, view link, PDF link                                                                              | Nothing                                                              |
| Proposal | status                                                                                                     | Nothing                                                              |
| Invoice  | status                                                                                                     | Nothing                                                              |
| Activity | actor, type, detail, time                                                                                  | One new entry per action, with the current user as actor             |
| User     | Current user's name, as the actor of new activities                                                        | Nothing                                                              |

Reads go through `GET /api/leads/{leadId}`; writes through the qualification, lost and spam routes (spec 04). In this build all of it is sample data and writes are not durable.

## Assumptions

- **Question 1:** the app owns the stage. Actions here change the stage in the app; pushing the change to the CRM is the adapter's job and is not built.
- **Question 5:** marking spam cancels the booking from the app. Assumed. In this build that means only that the sample booking's state changes. The handoff also says a polite note is sent to the lead; who sends it is part of question 5 and nothing is sent here.
- **Question 4:** a suspect's booking is kept until a rep reviews it. Assumed.
- **Question 8:** statuses set by actions use the prototype's status lines. Assumed.
- **Question 7:** any authenticated user can act on any lead. Under the proposed roles, staff would act only on their own leads.
- **Question 3:** the invoice is a draft the rep checks elsewhere. Assumed.
- "Call completed" is read from the booking's state. Which party sets that state in real use is part of question 1.
- Separating "Not qualified" (status "Not a fit") from "Mark lost" (status "Removed from pipeline") is proposed; both end in the Lead Lost exit.
- No action restores an exited lead. Proposed.
- The reason on Mark lost is free text and optional. Proposed.

## Acceptance checks

1. Opening a sample lead shows the header chips, details, form answers, verdict box, the three status panels and the timeline, with data on first paint.
2. For one sample lead in each row of the action table, the main action, secondary action and hint line match the table.
3. On a lead whose discovery call is completed, pressing Qualified changes the stage chip to Qualified and the status to "Qualified", replaces the main action with Start proposal, and adds a timeline entry naming the signed-in user.
4. Pressing Not qualified asks for confirmation; confirming moves the lead to Lead Lost with status "Not a fit"; cancelling changes nothing.
5. Mark lost with a reason moves the lead to Lead Lost and the timeline entry shows the reason.
6. Mark spam moves the lead to Spam, shows its upcoming booking as cancelled and removes all actions.
7. An exited lead shows its name struck through, its exit, an explanatory hint line and no actions.
8. After any action, returning to the Pipeline shows the lead under its new stage or exit and the counts changed to match.
9. The page contains no "Generate presentation" and no "Get proposal link" control, and no text naming a CRM or "Atomic Slides".
10. Open deck leads to the deck presenter placeholder; Start proposal and Finish proposal lead to the proposal builder placeholder; Check invoice draft is disabled with an explanation.
11. An address with an unknown lead id shows the not-found panel inside the shell.
12. Forcing an action request to fail leaves chips, actions and timeline unchanged and shows a retry.
13. While an action is in progress, no other action can be pressed.
14. A suspect that has been reviewed shows the outcome, the reviewer and the time in the verdict box.
15. Confirmations trap focus, close on Escape and return focus to the button that opened them.
16. The page reads correctly in one column at 700px wide.

## User Stories

1. As a rep, I want everything about a lead on one page, so that I do not hunt across tools.
2. As a rep, I want to see the lead's stage and status at the top, so that I know where it stands.
3. As a rep, I want one main action for the lead's current situation, so that I know what to do.
4. As a rep, I want a line telling me what to do next and why, so that I do not have to remember the process.
5. As a rep, I want to see the lead's contact details, so that I can reach them.
6. As a rep, I want email, phone and website to be links, so that I can use them in one click.
7. As a rep, I want to read the lead's form answers, so that I know what they asked for.
8. As a rep, I want the AI's verdict with its summary, so that I know whether to trust the lead.
9. As a rep, I want the AI's reasons listed, so that I can judge the verdict myself.
10. As a rep, I want to go from a suspect lead to reviewing it, so that I can decide straight away.
11. As a rep, I want to see who cleared or rejected a suspect and when, so that I know a person checked it.
12. As a rep, I want to see the next call and its state, so that I can prepare or follow up.
13. As a rep, I want to open the deck before a call, so that I can present it.
14. As a rep, I want to record qualified after the call, so that the lead moves on.
15. As a rep, I want to record not qualified, so that the lead leaves my pipeline.
16. As a rep, I want to be asked before a lead is removed, so that a slip does not lose it.
17. As a rep, I want to start the proposal from a qualified lead, so that I do not look for where to begin.
18. As a rep, I want to see the proposal's status, so that I know whether it was sent, viewed or signed.
19. As a rep, I want to see the invoice status on a won lead, so that I know it is being billed.
20. As a rep, I want to mark a lead lost with a reason, so that the record says why.
21. As a rep, I want to mark a lead spam, so that it stops taking my time.
22. As a rep, I want a timeline of what has happened, so that I can pick up a lead I have not touched in days.
23. As a rep, I want the timeline to say whether a person, the system or the CRM acted, so that I understand the history.
24. As a rep, I want my action to show in the timeline at once, so that I know it worked.
25. As a rep, I want a clear message when an action fails, so that I can retry.
26. As a rep, I want buttons that do not apply to be absent, so that I am not tempted to press them.
27. As a rep, I want an exited lead to show why it left, so that I do not chase it.
28. As a rep, I want to go back to the Pipeline with my filters intact, so that I can continue down my list.
29. As a rep, I never want to see which CRM is behind the app, so that I work in one place.
30. As a rep following a stale link, I want to be told the lead does not exist, so that I do not wait on a blank page.
31. As a keyboard user, I want to reach every action and confirm or cancel without a mouse, so that I can work quickly.
32. As a developer, I want the rule for which action shows when in one place, so that the page and the server cannot disagree.

## Implementation Decisions

- The page lives inside the shell at `/dashboard/leads/{leadId}` (spec 04). Its Server Component prefetches the lead detail; the hook takes over on the client (ADR-0001).
- One lead-detail query; three mutations (qualification, lost, spam) defined in spec 04's contract. Each mutation returns the updated lead, which replaces the cached detail; the lead list and pipeline summary are invalidated.
- No optimistic updates. The page waits for the server's answer, because each action changes several things at once (stage, status, booking, timeline) and the server is the one place that knows the result.
- **Which action is available** is one pure function of the lead (stage, exit, verdict, review outcome, bookings). It is shared by the page, to choose the buttons and the hint line, and by the data-access layer, to refuse a write the lead's state does not allow. The table in this spec is its specification.
- The server refuses a disallowed action with the conflict error from spec 04; the page then reloads the lead.
- Each write adds an activity with the current user as actor. Writes are applied in the data-access layer, in memory, in this build (spec 04).
- Confirmations are accessible modal dialogs.
- Chips and the verdict box take their tone from spec 03's single mapping.
- Links to the deck presenter and proposal builder placeholders carry no lead-specific behaviour in this build.
- Times are shown in the viewer's time zone, with the exact time available on hover and focus.

## Testing Decisions

_Seams confirmed by the owner: data-access functions and Route Handlers through their public behaviour with Vitest; pages through Testing Library at page level; no end-to-end browser suite yet._

- A good test gives a lead in a known state and checks what the rep is offered and what an action results in.
- **The available-action function**, with Vitest: one case per row of the action table, plus the exited cases. This is the highest-value test in the spec.
- **Data-access functions** (get lead, set qualification, mark lost, mark spam), with Vitest: the resulting stage, exit, status, booking state and new activity for each; refusal of each action in states that do not allow it; unknown lead.
- **Route Handlers**, with Vitest: validation of the decision and reason; not found; conflict.
- **Page**, with Testing Library: the sections render from a lead; the right buttons and hint line for representative states; confirmation flow; progress and failure states; no forbidden strings.
- No end-to-end browser suite yet.
- Prior art: none in the repo.

## Out of Scope

- Editing a lead's details or reassigning its owner.
- Notes, comments, tasks, attachments, sending email or SMS from the app.
- Presenting, editing or generating a deck (spec 13).
- Building, sending or tracking a proposal (spec 14).
- Creating or viewing an invoice (spec 15).
- Restoring a lead from an exit; moving a lead backwards.
- Booking, rescheduling or cancelling a call, other than the cancellation implied by Mark spam.
- Pushing any change to the CRM (spec 11).
- Running validation (spec 10).
- Live updates while the page is open.

## Further Notes

- The prototype's five buttons map as follows: Generate presentation, removed; Qualified and Not qualified, kept but shown only after the discovery call; Get proposal link, replaced by Start proposal and Finish proposal; Mark spam, kept.
- The architecture review's version of this screen lists "Claude's research and its reasons". This spec shows the verdict's summary and reasons from the data model sketch; a separate research field is not in the sketch and is left to spec 10.
