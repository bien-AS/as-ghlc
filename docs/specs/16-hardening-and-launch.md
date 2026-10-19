---
title: Hardening and launch
status: ready
sessions: S16, S17
registry: none (no screens)
waiting_on:
  - Lee: a throwaway location or sandbox window for destructive replay tests (S16), and the production connector and webhooks (S17)
  - Zachery: the Vercel AS team and production Supabase project
---

# 16. Hardening and launch

**Purpose:** prove the app is safe to put real reps and real leads on, then put it in production.

## Hardening (S16)

- The isolation suites (spec 01) re-run in full, across every table and every lead-owned data-access function.
- Webhook tests for GHL, Smart Pricing Table and Invoice Ninja: forged, replayed, out-of-order and duplicate deliveries.
- Security headers, rate limits on every public route (`/login`, `/auth/callback`, webhooks), zod validation on every input.
- Playwright journeys for both milestone gates (lead arrival to presented deck; lead to signed proposal to invoice pair to Lead Won), with axe at serious and critical as failures.
- Security review of the whole diff, and gstack `/cso` if gstack is running.

## Launch (S17)

- Production on Vercel (AS team) with the production Supabase project, Inngest, and the production GHL location's token, ids and webhooks (spec 06 config).
- Migrations applied by procedure, with a backup first; rollback documented.
- Monitoring: Sentry, Inngest run history, the sync log.
- Smoke test against production with a test contact Lee creates, then removes.
- The M2 gate: the full funnel in staging, silence paths moving statuses, every P2 screen verified.

## Acceptance checks

1. Every webhook refuses forged and replayed requests.
2. Both journeys pass in staging, with no serious or critical accessibility finding.
3. A production smoke contact goes from form to verdict to W1 and is removed cleanly.
