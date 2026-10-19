# AS Sales App: Build Plan (solo, session-sequenced)

Builder: **Bien (Bienvenido Jamon) + Claude Code**, full orchestration on a Max account. Product owner: Zachery (plan approval, ADR review, milestone gates). No human team, no sprints: sessions are scope units grouped into arcs; Bien runs as long as he chooses and resumes from the handoff artifacts. Machine-readable twin: `project.json` `sessions[]` (byte-consistent with this file).

**The GHL side is a parallel workstream, not a second code lane.** Lee owns it; connection points and what Lee owes at each session live in `docs/ghl-workstream.md`. Sessions S6, S10, S13, and S14 name their Lee dependencies explicitly.

## Arcs and gates

| Arc | Sessions | Closes with |
|---|---|---|
| foundations | S0 S1 S2 S3 S4 | S4 gates individually (risk: schema + RLS) |
| lead-engine | S5 S6 S7 S8 | qa-reviewer over the arc diff + gstack /qa (S8); S5/S6 also gate individually (auth, connector) |
| deck-engine | S9 S10 | arc gate at S10, then the M1 milestone gate |
| proposal-engine | S11 S12 S13 | arc gate at S13; S11/S13 gate individually (risk) |
| pipeline-ops | S14 S15 | arc gate at S15 |
| hardening | S16 S17 | M2 milestone gate |

Merging sessions in one sitting is normal; **IDs are never renumbered** (insert as S8b). A later milestone's sessions never start before the current gate passes without Zachery's explicit say-so, logged in build-log.

## gstack cadence (tier-scoped, enforced)

| Tier | gstack step |
|------|-------------|
| S0 Onboarding | Staff builder: install gstack FIRST (`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`), then `/health`. Operator builder: run `/health` and fix anything it flags |
| S2 close | **Team mode wired into the repo**: `(cd ~/.claude/skills/gstack && ./setup --team) && ~/.claude/skills/gstack/bin/gstack-team-init required && git add .claude/ CLAUDE.md && git commit -m "require gstack for AI-assisted work"`. Any clone auto-bootstraps and auto-updates gstack, and AI-assisted work in the repo is blocked without it; kept even solo (no update drift, and the repo is ready if the build ever moves to 2-man-as-saas) |
| S1 close | `/plan-eng-review` over the ADR set + schema draft; findings fixed before S2 |
| Any bug or unexplained failure, any session | `/investigate`: root-cause before fixing |
| Arc close | `/qa <dev URL>` over the arc's built screens (fixes what it finds, writes regression tests), beside the qa-reviewer or `/code-review` diff pass |
| Milestone gate (M1, M2) | `/qa` runs the full phase-gate journey in a real browser, then `/design-review` audits the shipped screens against the Vantage system, before the gate is called |
| Milestone passed | `/document-release` brings docs current; `/retro` over docs/build-log.md |
| Sh Hardening (S16) | `/cso` (OWASP + STRIDE) beside the probe suite and `/code-review` |
| Sl Launch Prep (S17) | `/setup-deploy` once, `/land-and-deploy` for the production merge, `/canary` post-deploy, `/benchmark` for the perf baseline |

Boundaries: the registry and this plan decide WHAT gets built; a gstack finding that expands scope becomes a TODO.md item or an inserted `S<n>b` session, never silent scope growth.

## Handoff protocol (every session ends with `/handoff`, no exceptions)

1. All changes committed. 2. `validate_registry.py` passes, statuses advanced, cert re-emitted if the registry changed. 3. `routes_diff.py` clean. 4. Tests green + CI floor (`check:deadclass`, `tsc --noEmit`). 5. STATUS.md updated, CLAUDE.md appended with new gotchas. 6. TODO.md states exactly where the next session starts. 7. One-line entry in docs/build-log.md. An interrupted session still runs 1, 5, 6, 7. The Stop-hook guard backstops between rituals.

## Sessions

### M1: Demoable (est 2026-10-28)

**S0 · Onboarding** (foundations). Bien's machine assumed bare: ONBOARD.md top to bottom, gstack first, post the completed checklist to Zachery. DoD: every item verified; gstack `/health` clean; model sanity check; `/handoff` clean.

**S1 · Architecture** (foundations, crit). ADRs: GHL connector + write-back seam design, Fathom transcript pipeline, Presenton embedding, Invoice Ninja draft flow, status mirror model, role-scoped tenancy, OpenRouter model choices. Reconcile every registry `data_deps` table into one `db/schema.ts` draft (17 business tables). Routing: Fable direct; Zachery reviews the ADR set. Close: `/plan-eng-review`, findings fixed. Screens: none.

**S2 · Scaffold** (foundations, crit). `new-app.sh as-sales-app` (GitHub mode; Bien creates the repo), data layer on the UI-only starter, Supabase project under the **john.smith org** (verify org id `yjfcrhncmqvyqtwinjyx`; the ray.smith decoy fails at deploy, not at list), ref into AS-CONNECTIONS.md **before any write**, `.mcp.json` filled, `vercel link --scope` explicit, repo-package merged, `typedRoutes` on, gstack team mode committed. DoD: dev server on :4400, CI floor green, first push. Screens: none.

**S3 · Design system** (foundations, crit). Vantage DS applied per SETUP.md, ThemeToggle everywhere, brand marks in `public/` (no client logo set: not per-client tooling), lead-engine screen contracts in `docs/design/`. **Receives the enhanced Presenton templates from Mitchell and Zachery (due EOD Fri Oct 10); AS-styled placeholders already in the repo keep S9 unblocked.** DoD: `check:deadclass` green, cold-boot contrast audit both themes. Screens: none.

**S4 · Schema + RLS isolation** (foundations, **risk, crit**, gates individually). Full `db/schema.ts` first cut, RLS default-deny on every business table, role-scoped policies (admin vs rep), timestamps, soft delete on leads and decks. **Failing-to-green cross-role probe**: write it first, watch it fail on a policy-less table, pass with policies. rls-prober wired. Routing: Fable designs, Sonnet implements, qa-reviewer gates every policy. Screens: none.

**S5 · Auth + shell + state libraries** (lead-engine, crit, auth gates individually). Workspace-restricted Google OAuth, middleware guards, DS shell + nav from the gating matrix. Screens: `login`, `auth-callback`, `access-denied`, `empty-state-library`, `error-state-library`.

**S6 · GHL connector core + seam** (lead-engine, **risk, crit**, gates individually). Inbound contact webhook to lead ingest; outbound status/stage writes; idempotency keys; every write logged. **Lee: connector app + scopes + dev-location webhook URLs (ghl-workstream §S6).** DoD: inbound + outbound proven against Lee's dev location, replay-safe. Screens: `sync-log`.

**S7 · Leads + research + dashboard** (lead-engine, crit). Lead list, lead detail (tabs, seam rail), research enrichment job on intake/booking, dashboard KPIs. Screens: `dashboard`, `lead-list`, `lead-detail`.

**S8 · Validation pipeline + suspect queue** (lead-engine, **risk**, arc close). Claude verdict job; classifier derived from the Typeform export (**Bien owns the export**); auto-label spam, queue suspects; human overrides feed back. Arc close: qa-reviewer diff pass + gstack `/qa`. Screens: `suspect-review-queue`, `validation-log`.

**S9 · Presenton deck generation** (deck-engine, **risk, crit**, gates individually). Presenton baked in; three template groups (Discovery Call, Follow Up, Strategy Session); generation from lead + research; PDF render; celebration on first deck. Screens: `deck-generate`, `deck-detail`, `first-value-celebration`.

**S10 · Deck editing + library + booking slide** (deck-engine, crit, arc close). Post-generation editing (structured slots + prompt-driven slide regen), deck library, **GHL booking calendar embedded on the last slide (Lee: calendar embed config, ghl-workstream §S10)**. Arc close + **M1 gate**: record the 5-minute demo, all P1 verified, isolation probe green, `/qa` + `/design-review`, then `/document-release` + `/retro`. Screens: `deck-edit`, `deck-library`.

### M2: Internal GA (est 2026-11-12)

**S11 · Fathom transcripts** (proposal-engine, **risk, crit**, gates individually). Recording-to-meeting matching (meeting time + attendee email; below-threshold renders unmatched, never guesses), transcript pull + storage, rematch surface, **manual-paste fallback ships in the same session**. Screens: `meeting-recordings`.

**S12 · Smart Pricing Table proposals** (proposal-engine, crit). Extraction from transcript + deck context, per-value accept/override, SPT create via API, prompt tweak area with preview diffs, send for signature. **Needs: SPT API credentials (Zachery).** Screens: `proposal-generate`, `proposal-detail`, `proposal-list`.

**S13 · Signature webhook + Invoice Ninja drafts** (proposal-engine, **risk, crit**, arc close). SPT signature webhook (verified) triggers the two-invoice draft with date logic; approver notified in-app; approve-and-send. Draft plus notify only. **Lee: stage update on signature (ghl-workstream §S13). Zachery: date-logic feasibility answer.** Arc close: qa-reviewer + `/qa`. Screens: `invoice-approvals`, `invoice-pair-detail`.

**S14 · Status engine + pipeline board** (pipeline-ops, crit). Full silence-path status set, lead-age automation (defaults: nurture 14d unbooked, lost after no-show chase, lost 14d silent post-proposal), qualification decisions, Lost/Won mirroring. **Lee confirms the status map (ghl-workstream §S14).** Screens: `pipeline-board`, `admin-statuses`.

**S15 · Notifications + admin cluster + onboarding** (pipeline-ops, arc close). Six notification types, rep provisioning, integrations health, template management, profile, welcome, palette. Arc close: qa-reviewer + `/qa`. Screens: `notifications-center`, `profile-settings`, `team-reps`, `admin-integrations`, `admin-templates`, `welcome-first-run`, `command-palette`.

**S16 · Hardening** (crit). Full probe suite, webhook signature tests (SPT, GHL, Invoice Ninja), headers, rate limits, validation sweep, Playwright E2E over both gate journeys + axe, `/cso`, `/code-review`. Screens: none.

**S17 · Launch prep** (crit). `/setup-deploy`, production Vercel config, migration procedure, monitoring, smoke tests, rollback, `/land-and-deploy`, `/canary`, `/benchmark`. Then the **M2 gate**: full funnel in staging, all P2 verified, `/qa` + `/design-review`, `/document-release` + `/retro`. Screens: none.

### Phase 4 backlog (unsequenced, scoped after M2)

loading-skeleton-library · reports-hub · admin-analytics · invoice-manager (the swap path if Mitchell widens invoicing) · admin-routing · GHL custom-field deck push · post-Lead-Won surfaces.

## Milestone dates are estimates

Derived from start 2026-10-13 at ~30 h/week (M1 ≈ 59 session-hours, M2 ≈ +47). The gate is the gate test, never the date. Bien's real hours/week re-derives both at the Friday review call.
