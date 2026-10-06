---
title: Invoices
status: blocked
blocked_by:
  - question 3
  - Invoice Ninja API access
  - the mapping of proposal fields to invoice lines
owner_to_ask:
  - Mitchell
  - Zach
build_now: false
---

# 15. Invoices

**Purpose:** draft an invoice the moment a proposal is signed and tell the rep to check it, so a won deal is billed without retyping. It serves reps.

> **Blocked.** This spec stops at the interface. It cannot go further until the items under "What is missing" arrive.

## What is missing, and from whom

| Missing                                                                                                                                                 | From                   | Why it blocks                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| **Question 3: how far invoicing goes.** Draft only, or send and manage invoices in the app. Assumed: draft only. Zach leans this way and is confirming. | Mitchell, through Zach | Decides whether this is one automatic step or a whole screen. |
| **API access to Invoice Ninja.**                                                                                                                        | Mitchell, through Zach | Nothing can be drafted without it.                            |
| **Which proposal fields map to invoice lines.**                                                                                                         | Mitchell, through Zach | The draft is built from the signed proposal.                  |

The Invoice Ninja API documentation has not been read.

## What is known

- Invoices are in scope. Settled on 5 October.
- Zach: Invoice Ninja's API plus webhooks can do this.
- The intended flow: on signature the draft is built, the rep is notified, and the rep finishes the invoice in Invoice Ninja.
- Invoices is the only block that calls Invoice Ninja.
- There is no invoice screen in the handoff's page list. An invoice appears as a status on the lead and as "invoice drafts" in the Pipeline's "needs you" strip.

## Interface

**Started by:** the signing event from Proposals (spec 14).

**Takes in:** the lead and its signed Proposal, including the line items snapshot.

**Produces:** an Invoice for the lead: the lead, the proposal, the invoice service's ID and a status. These are the Invoice fields in the data model sketch (assumed, spec 09). The status values are not listed in the sketch.

**Hands on to:** Notifications, to raise "Invoice draft ready" (spec 08); the lead's timeline.

**Consumed today by:** Lead detail (spec 06) and Pipeline (spec 05), which show an invoice's status from sample data. Lead detail's Check invoice draft action is shown disabled.

Nothing past this line is specified: not the draft's contents, the field mapping, the status values, where "check the draft" takes the rep, failure handling, or anything about sending or managing invoices.

## In the current build

Nothing is built. There is no invoice screen and no placeholder for one.

## When unblocked

Once question 3 is answered and access arrives, this file is rewritten as a full spec. The handoff's work order places it eleventh.
