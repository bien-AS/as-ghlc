---
title: Proposals and the proposal builder
status: blocked
blocked_by:
  - question 6
  - SmartPricingTable API access from Mitchell's account
  - the Authority Solutions proposal template ID
owner_to_ask:
  - Zach
  - Mitchell
build_now: false
---

# 14. Proposals and the proposal builder

**Purpose:** let a rep build a proposal from the lead's details and their own prices, review it, send it, and learn when it is viewed and signed. It serves reps.

> **Blocked.** This spec stops at the interface. It cannot go further until the items under "What is missing" arrive.

## What is missing, and from whom

| Missing                                                                                                                                                       | From                   | Why it blocks                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| **API access to SmartPricingTable (SPT).** It has to come from Mitchell's account.                                                                            | Mitchell, through Zach | Nothing can be created, sent or checked without it. The API is in beta. |
| **Question 6: how the app learns a proposal was signed.** Whether SPT can push a signature to us or must be polled. Assumed: poll proposal status and events. | Zach, Mitchell         | Decides how a lead reaches Lead Won, and how soon.                      |
| **The Authority Solutions proposal template ID.**                                                                                                             | Zach, Mitchell         | Proposals are created from a template.                                  |
| **The client-facing proposal link.**                                                                                                                          | Zach, Mitchell         | Needed for the rep to open or share what the lead sees.                 |

## What is known

- Proposals are built in the app and created in SPT. Settled on 5 October.
- SPT's API uses a bearer API key.
- A proposal is created from a template, with the client under `settings.recipient`.
- Line items are added with prices in dollars.
- `POST /proposals/{id}/send-email` sends the proposal and marks it Sent.
- SPT's statuses are draft, sent, won, lost, cancelled.
- SPT's analytics events include `proposal_viewed` and `proposal_signed`.
- A proposal that is pending signature, won or lost cannot be edited.
- The lead receives the proposal from SPT and signs it there. The lead never signs in to the app.
- Proposals is the only block that calls SPT.

## Interface

**Started by:** the rep, from a lead in Qualified or Proposal Review Booked. Later, by the signing event.

**Takes in:** client details from the lead; services with a price each, and context, from the rep.

**Produces:** a Proposal for the lead: the proposal service's proposal ID, a status (draft, sent, viewed, signed, lost) and a snapshot of its line items. These are the Proposal fields in the data model sketch (assumed, spec 09).

**Hands on to:** Pipeline, to move the lead to Proposal Sent on sending and to Lead Won on signing; Invoices (spec 15), on signing; Notifications, to raise "Proposal signed" (spec 08); the CRM adapter, for the stage change; the lead's timeline.

**Proposal builder screen**, per the handoff's page list: shows client details from the lead, services with a price each, a preview and the status; actions are generate, review, send.

**Consumed today by:** Lead detail (spec 06) and Pipeline (spec 05), which show a proposal's status from sample data, and offer Start proposal and Finish proposal.

Nothing past this line is specified: not the builder's fields or layout, the list of services, pricing rules, the preview, how "viewed" is detected, how app statuses map to SPT's, or what "lost if the lead stays silent" means in time.

## In the current build

In the first build the proposal builder was a placeholder at `/dashboard/proposal-builder` (spec 04). It is now a mockup on sample data; see below. No proposal is created in any proposal service.

## As built (mockup)

> **This is a mockup.** It runs on sample data, connects to nothing outside the app, and is built on the assumptions listed here. This spec's status and its open questions are unchanged.

**What the mockup shows**

- The proposal builder at `/dashboard/proposal-builder`. With no lead in the address it lists the leads from Qualified onwards with where each proposal stands. With `?lead=…` it opens that lead's proposal.
- **Client details** prefilled from the lead. **Services, each with a price:** add one from a catalogue or a custom one, edit, remove, with a running total. A **context** field. A **preview** drawn in the app. The **status** as a word in a chip: Not started, Draft, Sent, Viewed, Signed, Lost.
- **Generate** (a draft with services suggested from the lead's form answers and budget), **save draft**, then **review and send** (a confirmation naming the recipient, the number of services and the total).
- A proposal that has been sent cannot be edited, as the spec's "What is known" requires.
- **Simulate what the lead does:** "Lead viewed it" and "Lead signed it", shown only on sample data. Signing moves the sample lead to Lead Won, creates the invoice draft (spec 15) and raises "Proposal signed" and "Invoice draft ready" (spec 08).
- Lead detail's Start proposal and Finish proposal actions and its Proposal panel lead here. A lead in Proposal Sent offers "Open proposal".

**Assumptions and mock choices**

| Where                                                                              | Question                     | What is assumed                                                                                                                                               |
| ---------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pollProposalService` in `src/lib/data/proposals.ts`                               | 6 (assumed)                  | The app learns of a view or a signature by polling. `simulateProposalEvent` passes in what a poll would have found.                                           |
| `toAppStatus` in `src/lib/services/proposal-service.ts`                            | The Note above (mock choice) | How the service's statuses and events map to the app's five: won or a signing event is Signed; lost and cancelled are Lost; sent with a view event is Viewed. |
| `SERVICE_CATALOGUE` and `suggestLineItems` in `src/lib/data/fixtures/proposals.ts` | None (unspecified)           | Eight invented services with one suggested price each; "generate" matches keywords in the form answers and stays within the stated budget.                    |
| `canHaveProposal` and `sendBlockedReason` in `src/lib/proposals/rules.ts`          | None (mock choice)           | A proposal can be started from Qualified onwards on a lead still in the pipeline. Sending needs one priced service and a client email.                        |
| `PROPOSAL_STATUS_META` in `src/lib/proposals/rules.ts`                             | None (mock choice)           | The tone of each status chip.                                                                                                                                 |

**What is faked**

- **Generate** calls no AI and no proposal service. **Send** sends no email; the review step says "Sample data: nothing is sent."
- **Viewed and signed** are two buttons standing in for the proposal service reporting back. The route behind them refuses once the data is real.
- The preview is drawn by the app; it is not the proposal service's layout, and it says so.
- The proposal template ID and the client-facing proposal link do not exist, so neither is shown.
- "Lost if the lead stays silent" is not built; a proposal becomes Lost only when its lead is marked lost.

**To go live** (function bodies only): in `src/lib/data/proposals.ts`, `listProposalLeads`, `getProposal`, `generateProposal`, `saveProposalDraft` and `sendProposal`; `simulateProposalEvent` and `pollProposalService` become the scheduled poll (or a webhook handler, if question 6 is answered that way); in `src/lib/services/proposal-service.ts`, the one place the proposal service's client will live, `createProposal`, `sendProposal`, `readProposal` and `toAppStatus`.

## When unblocked

Once API access arrives and question 6 is answered, this file is rewritten as a full spec. The handoff's work order places it tenth.

## Note

The data model sketch's Proposal statuses (draft, sent, viewed, signed, lost) differ from SPT's own (draft, sent, won, lost, cancelled). The mapping between them is part of the unblocked spec, not decided here.
