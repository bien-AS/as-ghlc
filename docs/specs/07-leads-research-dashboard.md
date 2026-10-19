---
title: Leads, research briefs and the dashboard
status: needs-clarification
sessions: S7
registry: dashboard, lead-list, lead-detail
waiting_on:
  - Spec 06 (leads come from the connector)
  - Question 1 below (what the research brief draws on)
---

# 07. Leads, research briefs and the dashboard

**Purpose:** give a rep one place to see their leads, one page per lead with everything known about it, and a home screen that says what needs them now. It serves reps; admins see every lead.

The registry entries for `dashboard`, `lead-list` and `lead-detail` hold the layout, affordances, modals and states; this spec adds what they leave open. Today's mockups (`/leads`, `/leads/[id]`) are the starting point and keep their tests where the behaviour is unchanged.

## Lead list (`/leads`)

- The kit's `DataTable`: name and company, verdict pill, stage, Lead Status, assigned rep (admins), age, next booking, next step. Search, sort, density and column choice come with the table. `null` sorts last in both directions; age on a never-synced lead shows "Not measured", never 0.
- Filters in the address: stage, verdict, Lead Status group, rep (admins), archived.
- A sync indicator per row: hovering shows the lead's last write to GHL and its result.
- Archive is a soft delete in the app only; it writes nothing to GHL.

## Lead detail (`/leads/[id]`)

- Header: name, company, verdict, stage, Lead Status, assigned rep. Tabs: Overview, Research, Decks, Proposals, Meetings, Timeline. Right rail: the next step, and the seam (each write to GHL for this lead, when, and its result).
- Actions and the write each causes, named in its modal before confirming:
  - **Qualify / Not qualified** → W3 (spec 06).
  - **Mark as spam** → W4.
  - **Change status** → the Lead Status values a rep may set by hand. Which those are is question 2; until answered, only admins can change status here.
  - **Assign rep** (admin) → app only, until assignment rules exist.
  - **Refresh research** → re-runs the brief, with a cost line before confirming.
- Tabs whose destination session has not shipped show their empty state and no button that would 404 (spec 01, phase flags).

## Research brief

Runs as an Inngest job on intake (with validation, spec 08) and again on "Refresh research". It produces markdown plus extracted facts into `lead_research`, and its summary is what W1 writes to Validation Summary in GHL, which the deck reads back later. Each run logs model, tokens and cost.

What it contains is assumed: the business's website (fetched and summarised), what it sells and where, its visible marketing (ads, socials, reviews), likely competitors, and a short "angle for the call". Each claim names its source.

## Dashboard (`/dashboard`)

- Three tiles at M1: new leads this week, suspects to review, calls in the next 48 hours. Decks and proposals tiles appear when their screens are live.
- "Needs you now": suspects waiting, calls without a deck, leads past a threshold (spec 14), each linking to the lead.
- Recent activity: the latest timeline entries across the rep's leads.
- KPIs come from a nightly rollup plus live counts; a number that cannot be computed shows "Not measured".

## Acceptance checks

1. A rep's list, detail pages, dashboard tiles and activity show only leads assigned to them; an admin sees all, with the rep filter.
2. Sorting by age puts never-synced leads last in both directions.
3. Each mutating action's modal names the GHL write; confirming it creates exactly one sync-log entry.
4. A research run stores markdown, facts and cost; a failed run shows an error state with retry and leaves the previous brief in place.
5. Nothing on these screens links to a screen that is not live.

## Open questions

1. **Research sources.** Is web fetch plus a model enough, or do we use an SEO data provider for rankings and competitors (the packet names none)? Who pays for it? (Zachery)
2. **Manual status change.** Which Lead Status values may a rep set by hand from the app, given GHL's workflows also set them? (Lee)
