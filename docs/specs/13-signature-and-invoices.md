---
title: Signature webhook and the invoice pair
status: blocked
sessions: S13
registry: invoice-approvals, invoice-pair-detail
waiting_on:
  - Zachery: the Invoice Ninja date-logic feasibility verdict
  - Invoice Ninja API token and webhook secret; the key owner
  - Smart Pricing Table signature webhook secret (spec 12's credentials)
  - Lee: which workflow fires when the app moves a lead to Lead Won (no double emails)
---

# 13. Signature webhook and the invoice pair

**Purpose:** when a lead signs, move them to Lead Won and draft their two invoices, so an admin only has to check and send them. Scope is draft plus notify; full invoice management is the Phase 4 `invoice-manager`.

## On signature

`POST /api/webhooks/spt`, verified with SPT's signature, recorded, answered 200, then an Inngest job:

1. Marks the proposal signed (idempotent on SPT's event id).
2. Writes W6: stage Lead Won (spec 06).
3. Drafts the **invoice pair** in Invoice Ninja from the signed proposal's line items: a one-time upfront invoice and a monthly recurring invoice, with the date logic below.
4. Notifies the approvers (spec 15, "invoice pair ready").

If step 3 is not feasible (Zachery's verdict), the job stops after step 2 and notifies the admin to draft by hand: the "notify-only" fallback.

## Date logic (assumed until Zachery confirms)

One-time invoice due on signature. Recurring invoice starts on the first of the next month, monthly. The rule's outcome is shown in words before approval, for example "Signed 1 November: one-time due now, recurring starts 1 December".

## Approvals (`/invoices`, `/invoices/[id]`)

- Admins act; reps see their own deals read-only.
- Each pair shows both invoices, their lines and totals, and the date logic in words. Amounts are read from Invoice Ninja's synced state, never recomputed in the app.
- **Approve and send** sends both through Invoice Ninja's API. **Flag for correction** keeps them as drafts with a note.
- Invoice Ninja webhooks update each invoice's state (sent, viewed, paid).

## Acceptance checks

1. A replayed or forged SPT webhook changes nothing and is recorded.
2. One signature produces exactly one W6, one invoice pair and one notification, even if the webhook arrives twice.
3. Amounts on screen equal Invoice Ninja's; a rep cannot approve, send or flag.
4. With drafting switched off (notify-only), the admin is notified and Lead Won is still written.
