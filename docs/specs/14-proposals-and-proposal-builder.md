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

The proposal builder is a placeholder at `/dashboard/proposal-builder` (spec 04). Lead detail's Start proposal and Finish proposal actions lead to it. No proposal is created.

## When unblocked

Once API access arrives and question 6 is answered, this file is rewritten as a full spec. The handoff's work order places it tenth.

## Note

The data model sketch's Proposal statuses (draft, sent, viewed, signed, lost) differ from SPT's own (draft, sent, won, lost, cancelled). The mapping between them is part of the unblocked spec, not decided here.
