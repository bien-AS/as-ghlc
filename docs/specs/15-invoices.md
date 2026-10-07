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

In the first build nothing was built: no invoice screen and no placeholder for one. A mockup of the draft now shows on Lead detail; see below.

## As built (mockup)

> **This is a mockup.** It runs on sample data, connects to nothing outside the app, and is built on the assumptions listed here. This spec's status and its open questions are unchanged.

This spec defines no screen, so the mockup adds none. The draft is shown where the spec places it: on **Lead detail** (spec 06).

**What the mockup shows**

- On a won lead, the Invoice panel shows the draft: its status ("Draft") as a word in a chip, one line per service with its amount, the total, and when it was drafted, with the line "Finish and send it in the invoice service. Sample data: there is nothing to open."
- A lead with no invoice says a draft is created when the proposal is signed.
- Lead detail's **Check invoice draft** action, which the first build showed disabled, now goes to that panel.
- Signing a proposal in the proposal builder mockup (spec 14) creates the draft and raises "Invoice draft ready" (spec 08).

**Assumptions and mock choices**

| Where                                                       | Question           | What is assumed                                                                                                   |
| ----------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `INVOICE_STATUS_WHEN_CREATED` in `src/lib/data/invoices.ts` | 3 (assumed)        | Draft only. It is the one status the app gives an invoice; the rep finishes it in the invoice service.            |
| `invoiceLinesFrom` in `src/lib/data/invoices.ts`            | None (mock choice) | One invoice line per line of the signed proposal's snapshot. The real mapping is one of the things still missing. |
| `INVOICE_STATUS_META` in `src/lib/invoices/rules.ts`        | None (mock choice) | The status words and tones. The status values are not listed in the data model sketch.                            |

**What is faked**

- The draft. It exists only in server memory and in no invoice service; there is nothing to open.
- One sample lead already carries the status "sent", so that word is in the contract. The app never produces it.
- Failure handling, and anything about sending or managing invoices, is not built.

**To go live** (function bodies only): in `src/lib/data/invoices.ts`, `getInvoice`, `createInvoiceDraft` and `invoiceLinesFrom`; `createInvoiceDraft` in `src/lib/services/invoice-service.ts`, the one place the invoice service's client will live.

## When unblocked

Once question 3 is answered and access arrives, this file is rewritten as a full spec. The handoff's work order places it eleventh.
