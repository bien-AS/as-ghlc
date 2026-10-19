---
title: Proposals in Smart Pricing Table
status: blocked
sessions: S12
registry: proposal-generate, proposal-detail, proposal-list
waiting_on:
  - Smart Pricing Table API credentials from Mitchell's account (Zachery, before S12)
  - The Authority Solutions proposal template id in Smart Pricing Table (Zachery, Mitchell)
  - Spec 11 (transcripts)
  - Lee: the GHL proposal link field (W5)
---

# 12. Proposals in Smart Pricing Table

**Purpose:** let a rep turn the discovery call into a priced proposal without typing it from scratch: values pre-filled from the transcript and the deck, every one shown and overridable, refined in plain language, then sent for signature from Smart Pricing Table (SPT). It serves reps.

## Generate (`/leads/[id]/proposals/new`)

- Inputs: the matched discovery transcript (spec 11) or a pasted one, the lead's deck and research, the rep's notes.
- An Inngest job extracts proposal values (services, quantities, scope notes, budget signals) with one OpenRouter call, each value carrying the transcript line it came from.
- The rep reviews every extracted value as an editable row (accept, change, remove, add). Nothing reaches SPT until the rep confirms. A cost line shows before the model call.
- Confirming creates the proposal in SPT from the AS template with the client as recipient, and a `proposals` row.

## Detail (`/proposals/[id]`)

- The proposal as SPT holds it: line items, total, status, the client-facing link.
- **Tweak in plain language** ("drop the second location", "make it a 6-month term"): the model proposes a change, a preview shows exactly what changes, and only on confirmation is a new revision written to SPT and stored in `proposal_revisions`. Preset chips come from `/admin/templates`.
- **Send for signature** → SPT sends it; the app writes W5 (proposal link, stage Proposal Sent; spec 06).
- **Withdraw** → cancels in SPT.
- Status shown: draft, sent, viewed, signed, lost. Signing is handled by spec 13; this screen only shows its result.

## List (`/proposals`)

Every proposal with lead, status and value. Value shows "Not measured" until SPT returns pricing, never $0.

## Acceptance checks

1. Every extracted value shows its source line and can be changed before anything is created in SPT.
2. A tweak's preview matches the revision written to SPT, and the revision history is kept.
3. Sending writes W5 once, visible in the sync log.
4. With no transcript matched, the paste fallback produces a proposal.
5. A rep cannot open another rep's proposal.

## Open questions

1. Does SPT's API (in beta) support creating line items from our values and sending, as documented, on Mitchell's plan?
2. What does "lost" mean in time for a silent proposal (spec 14)?
