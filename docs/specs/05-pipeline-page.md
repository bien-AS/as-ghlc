---
title: Pipeline page
status: ready
blocked_by: []
owner_to_ask:
  - Lean
build_now: true
---

# 05. Pipeline page

**Purpose:** show a rep every lead by stage and what needs them today, and let them find and open any lead. It serves reps, and anyone overseeing them. It is the home screen of the dashboard.

> **Flagged for question 8.** The stage table is ready. The list of statuses inside each stage is **assumed** to be the prototype's status lines; Lean has not confirmed it. The status list drives the status line on each row. Build it from one list so the answer to question 8 changes one place.

## Problem Statement

A rep has no single place to see their leads. They cannot tell which leads are waiting on them, how many leads sit at each stage, or find one lead among many. The prototype's lead list showed a handful of leads with no search, no filters and no counts, and would not cope with real volume.

## Solution

One page at `/dashboard` with three parts, top to bottom.

### 1. "Needs you" strip

Four counts, each a button that filters the list to those leads:

| Item               | Counts leads that                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Suspects to review | Have a suspect verdict with no review outcome. Opens Suspect review (spec 07) instead of filtering. |
| Calls today        | Have a confirmed booking of either kind dated today                                                 |
| Proposals to send  | Are in Qualified or Proposal Review Booked and have no proposal, or a proposal still in draft       |
| Invoice drafts     | Are in Lead Won with an invoice in draft                                                            |

A count of zero is shown as zero and its button is inactive.

### 2. Stage tabs with counts

A row of tabs, each with its count: **All open** (every lead still in the pipeline), then the six stages in order (New lead, Discovery Call Booked, Qualified, Proposal Review Booked, Proposal Sent, Lead Won), then the three exits (Spam, Nurture, Lead Lost), visually set apart from the stages. All open is selected by default. Counts are for the whole pipeline and do not change with search or the other filters.

### 3. Lead list

Search and filters above a dense list.

- **Search** by name, company or email.
- **Filters:** verdict (valid, suspect, spam, awaiting verdict) and rep (the lead's owner). Stage is filtered by the tabs.
- **Each row shows:** lead name, company, the status line, a verdict chip, the next call (date and time, or "No call booked"), and the owner. Under All open, each row also shows its stage.
- A lead that has left the pipeline is shown with its name struck through and its exit named.
- Selecting a row opens Lead detail (spec 06). The whole row is the target.
- The list loads a page at a time and loads more on request as the rep reaches the end.
- A line above the list states how many leads match the current search and filters, and offers **Clear filters** when any are set.

Search, filters, tab and "needs you" selection are kept in the page address, so a filtered view can be reloaded, shared or returned to with Back.

### Stages

| Stage                  | How a lead gets here                                      | What the rep does                            | What happens on its own                                                             |
| ---------------------- | --------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| New lead               | Form submitted                                            | Reviews the lead if the verdict is suspect   | The AI validates. Valid leads get a deck. The CRM emails leads who have not booked. |
| Discovery Call Booked  | The lead books a call                                     | Presents the deck, edits text, sends the PDF | The CRM chases no-shows and cancellations                                           |
| Qualified              | The rep marks qualified after the call                    | Starts the proposal                          | The CRM sends the follow-up sequence                                                |
| Proposal Review Booked | The lead books from the calendar on the deck's last slide | Finishes and reviews the proposal            | None                                                                                |
| Proposal Sent          | The rep sends the proposal from the app                   | Watches for viewed and signed, or marks lost | Lost if the lead stays silent                                                       |
| Lead Won               | The lead signs the proposal                               | Checks the invoice draft                     | Invoice drafted, rep notified                                                       |

| Exit      | Trigger                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| Spam      | A spam verdict, or a rep marking a lead spam (assumed, question 5)           |
| Nurture   | No booking or no activity for two weeks. Automatic. Another team takes over. |
| Lead Lost | Disqualified, silent after a proposal, or marked lost by the rep             |

This page only displays stages and exits. In this build nothing moves on its own; leads sit where the sample data puts them, and move only through the actions in specs 06 and 07.

### Status lines (assumed, question 8)

| Status                   | Typical stage or exit                 | Tone  |
| ------------------------ | ------------------------------------- | ----- |
| Awaiting verdict         | New lead                              | warn  |
| Flagged suspect          | New lead                              | crit  |
| Drip chasing the booking | New lead                              | warn  |
| Deck ready               | New lead, Discovery Call Booked       | ok    |
| Needs a decision         | Discovery Call Booked                 | brand |
| Qualified                | Qualified, Proposal Review Booked     | ok    |
| Proposal ready           | Proposal Review Booked, Proposal Sent | ok    |
| Not a fit                | Lead Lost                             | crit  |
| Removed from pipeline    | Spam, Nurture, Lead Lost              | crit  |

The prototype's "Needs a deck" status is dropped: decks generate on their own for valid leads.

## States

| State                        | What the rep sees                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| First load                   | Data is present on first paint (prefetched). No skeleton in the normal case.                                                                       |
| Loading                      | When data is not yet available: skeleton counts in the strip and tabs, and skeleton rows shaped like lead rows.                                    |
| Refreshing                   | Changing a filter keeps the current rows visible, dimmed, until the new ones arrive. No blank flash.                                               |
| Loading more                 | A progress row at the end of the list.                                                                                                             |
| Empty, no leads at all       | Empty state: "No leads yet", with one sentence saying leads appear here when they come in from your CRM.                                           |
| Empty, tab has no leads      | "No leads in {stage}."                                                                                                                             |
| Empty, filters match nothing | "No leads match", restating the search and filters, with Clear filters.                                                                            |
| Error, list                  | Error state in place of the list with Try again. The strip and tabs stay if they loaded.                                                           |
| Error, summary               | The strip and tab counts show no numbers rather than zeros, with a small retry. The list still works.                                              |
| Error, loading more          | The rows already loaded stay; an inline retry replaces the progress row.                                                                           |
| End of list                  | A quiet "All {n} leads shown".                                                                                                                     |
| Long content                 | Long names and companies truncate with the full text available on hover and focus; rows never wrap to uneven heights.                              |
| Narrow screens               | Below 720px each row stacks to name and company, status line, then verdict and next call. Tabs scroll sideways. Filters collapse behind a control. |

## Data

| Entity   | Read                                                                | Written |
| -------- | ------------------------------------------------------------------- | ------- |
| Lead     | name, company, email (search only), stage, exit, status, owner      | Nothing |
| Verdict  | result, review outcome                                              | Nothing |
| Booking  | kind, time, state (for next call and calls today)                   | Nothing |
| Proposal | status (for proposals to send)                                      | Nothing |
| Invoice  | status (for invoice drafts)                                         | Nothing |
| User     | Not read here. Owners in the sample data are sample reps (spec 04). | Nothing |

The page reads through `GET /api/leads` and `GET /api/pipeline/summary` (spec 04). It writes nothing.

## Assumptions

- **Question 8:** the status list is the prototype's first set, minus "Needs a deck". Assumed.
- **Question 1:** the six stage names are the app's own and follow the pipeline Lean built. The mapping to any CRM's stages is not this page's concern. Assumed until the adapter contract is reviewed.
- **Question 7:** every authenticated user sees every lead, and the rep filter is available to everyone. Under the proposed roles, staff would see only their own leads and the rep filter would be for admins and owners. Not built now.
- **Question 5:** the Spam exit's trigger is as assumed in the handoff.
- **Question 3:** "Invoice drafts" assumes invoicing stops at a draft the rep checks.
- A tabbed dense list, not a board of columns, is proposed for high volume. Final layout is settled in the design workflow.
- "Today" is the day in the viewer's own time zone. Proposed.
- The definitions of the four "needs you" counts in the table above are proposed; the handoff names the four items but does not define them.

## Acceptance checks

1. `/dashboard` shows the strip, the tabs with counts and the list, with data on first paint.
2. The tab counts add up: All open equals the sum of the six stages; each tab's count equals the number of rows when no other filter is set.
3. Each tab shows only leads in that stage or exit.
4. Typing part of a name, a company or an email narrows the list to matching leads, ignoring case.
5. Verdict and rep filters each narrow the list, and combine with search and tab.
6. Each "needs you" count equals the number of leads its button shows, by the definitions above. Suspects to review opens Suspect review.
7. Reloading a filtered view shows the same view; Back after opening a lead returns to the same filters and scroll position.
8. Each row shows name, company, status line, verdict, next call and owner; an exited lead is struck through and names its exit.
9. Selecting a row, by click or by keyboard, opens that lead's detail page.
10. A search with no matches shows the "No leads match" state with Clear filters, which restores the unfiltered list.
11. Forcing the list request to fail shows the error state with a working Try again, and the tabs remain.
12. Scrolling to the end loads the next page until "All {n} leads shown" appears; no lead appears twice.
13. No text on the page names a CRM.
14. Every status in the sample data is one of the nine listed, and each has a tone.
15. The page works at 700px wide with no horizontal page scroll.
16. Tabs, filters, rows and strip buttons are all operable by keyboard with visible focus.

## User Stories

1. As a rep, I want to see all my open leads in one list, so that I know my workload.
2. As a rep, I want leads grouped by stage, so that I can work one stage at a time.
3. As a rep, I want a count on each stage, so that I can see where leads pile up.
4. As a rep, I want to see what needs me today at the top, so that I start with what matters.
5. As a rep, I want to jump from "suspects to review" straight into reviewing, so that I clear them quickly.
6. As a rep, I want to see today's calls, so that I can prepare.
7. As a rep, I want to see which proposals I still have to send, so that none are forgotten.
8. As a rep, I want to see invoice drafts waiting to be checked, so that won deals get billed.
9. As a rep, I want each row to show the lead's status in a line, so that I know its situation without opening it.
10. As a rep, I want each row to show the verdict, so that I know whether the lead is trusted.
11. As a rep, I want each row to show the next call, so that I can see what is coming.
12. As a rep, I want each row to show the owner, so that I know whose lead it is.
13. As a rep, I want to search by name, company or email, so that I can find a lead someone mentions.
14. As a rep, I want to filter by verdict, so that I can focus on one kind of lead.
15. As a team lead, I want to filter by rep, so that I can see one person's pipeline.
16. As a rep, I want to see leads that left the pipeline when I ask for them, so that I can check what happened.
17. As a rep, I want removed leads to look removed, so that I do not mistake them for live ones.
18. As a rep, I want to open a lead from its row, so that I can act on it.
19. As a rep, I want my filters kept when I come back from a lead, so that I do not rebuild them.
20. As a rep, I want to share a filtered view by link, so that a colleague sees what I see.
21. As a rep, I want the list to stay fast with many leads, so that volume does not slow me down.
22. As a rep, I want the old rows to stay while a filter loads, so that the page does not flash.
23. As a rep, I want a clear message when nothing matches, so that I know it is my filter and not a fault.
24. As a rep, I want a retry when loading fails, so that I am not stuck.
25. As a rep, I want to clear all filters at once, so that I can start over.
26. As a rep on a small screen, I want rows to stack readably, so that I can check leads away from my desk.
27. As a keyboard user, I want to move through tabs and rows and open a lead without a mouse, so that I can work quickly.
28. As a rep, I never want to see the name of the CRM, so that the app is the only tool I think about.
29. As a new user with no leads, I want to be told where leads come from, so that I know what to expect.
30. As a developer, I want the status list in one place, so that the answer to question 8 is one change.

## Implementation Decisions

- The page is the dashboard's index route, inside the shell (spec 04).
- Data comes from the two resources defined in spec 04: the lead list (paged) and the pipeline summary. The page's Server Component prefetches both for the address's current filters; the hooks take over on the client (ADR-0001).
- The list is an infinite query over the cursor from `GET /api/leads`. The page size is proposed at 25.
- Search input is debounced before it changes the address and the query.
- The page address is the single source of filter state. Controls read from it and write to it; nothing is held in separate component state.
- Tab counts and "needs you" counts come from the summary resource and are independent of the list's filters.
- The "needs you" definitions and the stage and exit filters are computed in the data-access layer, not in components, so they move with the data when it goes live.
- "Calls today" needs the viewer's day boundaries; the client sends its time zone offset with the summary and list requests. Proposed.
- Statuses are one ordered list with a label and a tone each (tone mapping from spec 03). Rows render the label from that list.
- Rows are links to `/dashboard/leads/{leadId}`.
- The page performs no writes and has no mutations.

## Testing Decisions

_Seams confirmed by the owner: data-access functions and Route Handlers through their public behaviour with Vitest; pages through Testing Library at page level; no end-to-end browser suite yet._

- A good test fixes a set of leads and checks what the list, counts and strip return for a given set of filters, without reference to how they are computed.
- **Data-access functions** (list leads, pipeline summary), with Vitest: each filter alone and combined, search across the three fields, the four "needs you" definitions including the day boundary, counts per stage and exit, cursor paging without duplicates or gaps. These carry most of the page's logic and are covered by spec 04's seam.
- **Route Handlers**, with Vitest: query parameters are validated; unknown stage, verdict or category values are rejected.
- **Page**, with Testing Library: rows render the six fields; tabs, search and filters update the address; each empty state; the error state and retry; exited leads are struck through.
- No end-to-end browser suite yet.
- Prior art: none in the repo.

## Out of Scope

- Moving a lead between stages from this page, by drag or otherwise.
- Bulk actions, selection of several leads, export.
- Sorting choices beyond the default order (proposed default: leads needing the rep first, then most recently updated).
- Saved views.
- Per-role visibility (spec 12).
- Automatic moves: nurture after two quiet weeks, lost after silence (later, with the lead store and adapter).
- Creating a lead by hand. Leads come from the CRM.
- Live updates while the page is open.

## Further Notes

- The architecture review words question 8 differently from the handoff: Lean suggested statuses for whether a lead has not booked, booked, cancelled, rescheduled or not shown up, and Zach agreed they can be both manual and time-based. Those overlap with booking states in the data model sketch. The answer may therefore replace part of the prototype's list rather than extend it.
- The prototype's lead list carried an open count; the All open tab's count takes its place.
