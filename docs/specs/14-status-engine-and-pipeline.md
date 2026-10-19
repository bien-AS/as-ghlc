---
title: Status mirror and the pipeline board
status: needs-clarification
sessions: S14
registry: pipeline-board, admin-statuses
waiting_on:
  - Lee: the status map and silence-path thresholds, and who moves leads on silence
---

# 14. Status mirror and the pipeline board

**Purpose:** show every lead where GHL has it, silence paths included, so reps and admins see the whole pipeline at a glance without opening GHL.

## The mirror

Stage and Lead Status are GHL's (spec 06). `status_defs` holds the 28 Lead Status values in their seven groups, which stages they occur in, a tone for each, and the silence-path thresholds. It is seeded from the GHL picklist; `/admin/statuses` edits tones and thresholds, never the list, which changes only when Lee changes GHL (announced in #as_ghl first).

## Silence paths (assumed: GHL moves, the app mirrors)

The packet's defaults: Nurturing at 14 days without a booking, Lost after the no-show chase, Lost 14 days silent after the proposal. The GHL spec says GHL moves leads to Nurturing after silence. Until Lee answers otherwise, **GHL makes these moves**; the app shows each lead's age against its threshold and lists overdue leads in "Needs you now", but does not move them. If the app is to move them, an Inngest cron does it through the same write path, and that needs Lee to say which workflow reacts.

## Pipeline board (`/pipeline`)

- Columns are the eight stages in GHL's order, each card showing name, company, Lead Status, age and rep.
- Dragging a card is a manual stage change through the same write path and modal as lead detail, and only to stages the app may set (Qualified, Lead Lost, Proposal Sent by their actions; others refused with the reason).
- Filters by rep (admin) and Lead Status group, kept in the address.

## Acceptance checks

1. Every lead appears in the column of its GHL stage within a minute of a change in GHL.
2. A drag to a stage the app may set writes once and shows in the sync log; a drag to a GHL-owned stage is refused with a reason.
3. Overdue leads list in "Needs you now" with how long they are past the threshold.

## Open questions

1. Who moves leads on silence, and the exact thresholds. (Lee, Mitchell)
2. Which Lead Status values may be set by hand from the app. (Lee; also spec 07)
