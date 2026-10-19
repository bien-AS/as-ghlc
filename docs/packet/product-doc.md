# AS Sales App · Product Doc

**Authority Solutions · Internal** · Version 1.0 · 2026-10-07
One-line vision: the sales rep's entire funnel in one app stacked on GoHighLevel: leads validated, research briefed, decks generated, proposals built from call transcripts, invoices drafted, with the rep never touching the CRM.

## 1. Overview & positioning

The AS Sales App is the front-of-house for the Authority Solutions sales funnel. It is fully built outside GoHighLevel and stacked on top of it: sales reps live in the app and never see GHL underneath. GHL remains the pipeline and automation backend and the system of record for contacts and opportunities; the app is where humans make decisions, and every decision writes back through one visible, logged seam. It sits in the AS internal portfolio beside as-vantage-domain-finder (the reference implementation) and the other Vantage-DS internal tools. Operated by sales reps (one at launch, designed for 3 to 4) with Zachery and Mitchell as admins; Bien builds it solo with Claude Code; Lee runs the parallel GHL workstream.

## 2. Scope & editions

MVP (M1 then M2) covers the full funnel for one rep: Typeform intake lands leads in app and GHL; Claude validates (valid / suspect / spam) with obvious spam auto-labeled and suspects queued for human judgment; auto-research briefs the rep; one click generates a Presenton deck (Discovery Call, Follow Up, or Strategy Session group) whose last slide embeds the GHL booking calendar; the Fathom transcript of the discovery call feeds Smart Pricing Table proposal generation with a natural-language tweak area; signature triggers the two-invoice draft in Invoice Ninja (one-time upfront plus monthly recurring with date logic) with in-app approval; statuses, silence paths included, mirror to GHL throughout. Single workspace, role-scoped. Explicitly deferred to Phase 4: GHL custom-field deck push, full in-app invoice management, multi-rep routing admin, reporting depth, post-Lead-Won surfaces.

## 3. Personas & entitlements

| Persona | Who | Access |
|---|---|---|
| admin | Zachery, Mitchell | Everything: all leads, admin cluster (reps, integrations, templates, statuses, logs), invoice approval |
| operator | Sales rep | Own assigned leads and their research, decks, proposals, meetings, notifications, profile; invoices and recordings read-only; no admin cluster |

No app billing tiers (internal tool). The full RBAC and nav gating matrix lives in `docs/screen-registry.md` §6.

## 4. Architectural foundation

The locked AS core (pointer: the skill's `references/stack.md` canon): Next.js 14 App Router + TypeScript strict on vantage-next-starter, `@vantage/design-system` pinned, Supabase Postgres with RLS on every business table via Drizzle, Supabase Auth with Workspace-restricted Google OAuth, Inngest for everything durable, Vercel hosting, OpenRouter for the Claude layers. What this product does with it: an event-driven funnel where inbound webhooks (GHL lead, SPT signature, Invoice Ninja events, Fathom sync) land in Inngest functions, every outbound GHL write flows through one idempotent path logged to `ghl_sync_log`, and the LLM pipelines (validation, research, deck content, proposal tweaks) run as logged, cost-tracked jobs. ADRs S1 must produce: connector + seam design, Fathom pipeline, Presenton embedding, Invoice Ninja draft flow, status mirror model, role-scoped tenancy, model choices per pipeline.

## 5. Tool stack

Locked core per the AS canon (one line above). Per-SaaS layers: **GoHighLevel** (pipelines, automations, calendars; the backend this app fronts) · **Presenton** (open-source deck generation baked in; HTML + PDF; AS templates in Git) · **Smart Pricing Table** (proposal generation + e-signature; full API) · **Invoice Ninja** (two-invoice drafting via API + webhooks) · **Fathom** (recordings and transcripts into proposal context) · **Typeform** (intake stays; Ruben's ad tracking depends on it; historical export seeds the spam classifier) · **OpenRouter** (Claude models for the four LLM pipelines).

## 6. Screen inventory summary

36 certified entries: 12 Phase 1 (Demoable), 19 Phase 2 (Internal GA), 5 Phase 4 backlog; 13/19/4 by tier; 3 libraries. Gate tests: M1 = the 5-minute lead-to-presented-deck demo with zero 404s; M2 = the full funnel in staging through signed proposal, drafted invoice pair, and Lead Won mirror. Authoritative inventory: `docs/screen-registry.md` (tables are not duplicated here; one source of truth).

## 7. Data model overview

Seventeen business tables as they will appear in `db/schema.ts`, all with RLS default-deny role-scoped policies, `created_at`/`updated_at`; soft delete on leads and decks: `profiles` (reps + admins, role, first-run and celebration flags, notification prefs) · `leads` (identity, source, assignment, current status) · `lead_research` (brief markdown + extracted facts) · `validation_runs` (verdict, confidence, patterns, cost, human override) · `lead_status_events` (every transition + GHL write ref) · `status_defs` (app status to GHL stage map + thresholds) · `decks` (group, template version, render state, share token) · `deck_templates` (group, version, manifest) · `meetings` (GHL bookings + Fathom match) · `transcripts` (speaker turns, source, match confidence) · `proposals` (SPT id, state, value) · `proposal_revisions` (tweak prompts + diffs) · `invoices` (pair-grouped, IN ids, synced amounts/dates, events) · `notifications` (per-profile feed) · `ghl_sync_log` (every outbound write: payload, result, idempotency key, retries) · `integration_connections` (per-provider non-secret config + health) · `app_settings` (thresholds, prompt presets, flags).

## 8. Design system

`@vantage/design-system` at the pinned tag (v6.11.0 at packaging; confirm against CHANGELOG at S2). Dark-first, RULES.md is law, `cn()` everywhere, 1rem = 14px, null means not measured. Client logo set: not shipped (leads are prospects, not the AS client roster).

## 9. Non-functional

Security: Workspace-restricted OAuth + provisioning check, RLS on all seventeen tables with a failing-to-green cross-role probe at S4, signature verification on every inbound webhook, service-role never in user-facing paths, rate limiting on anything reachable beyond the Workspace. Cost: CostPreview in front of every LLM spend; every pipeline run logged with cost; OpenRouter spend on the integrations card. Observability: sync-log and validation-log as first-class forensic surfaces; Inngest run history; Sentry at S17. Data honesty: null renders as not measured, never zero, on ages, values, and costs.

## 10. Outputs registry

The running product produces: decks (HTML artifacts + PDFs, share-tokened) · proposals (in Smart Pricing Table, app-tracked) · invoice pairs (drafted then sent in Invoice Ninja) · GHL writes (statuses, stages, booking-linked fields; all logged) · research briefs · notifications · the validation audit trail.

## 11. Build plan summary

Bien (staff builder) + Claude Code, solo agentic, starting 2026-10-13 at ~30 hours/week (both confirmed at the Friday Oct 10 review call; dates are estimates, never commitments). Eighteen sessions in six arcs: foundations (S0 to S4, risk-first schema + RLS), lead-engine (S5 to S8), deck-engine (S9 to S10, closing M1 Demoable, est Oct 28), proposal-engine (S11 to S13), pipeline-ops (S14 to S15), hardening (S16 to S17, closing M2 Internal GA, est Nov 12). Risk-first ordering puts isolation, the GHL connector, Presenton generation, Fathom matching, and the invoice date logic as early as dependencies allow. Full plan: `docs/build-plan.md`; Lee's lane: `docs/ghl-workstream.md`.

```
build_plan:
  project: as-sales-app
  owner: authority-solutions
  start_date: 2026-10-13
  hours_per_week: 30
  team_mode: solo
  builder: staff:bienvenido
  product_owner: Zachery
  build_method: "solo agentic (builder + Claude Code; Fable 5 orchestrator)"
  stack: "locked per references/stack.md (Next 14 + @vantage/design-system v6.11.0 + Supabase/Drizzle/Inngest/Vercel); layers: [GoHighLevel, Presenton, Smart Pricing Table, Invoice Ninja, Fathom, Typeform, OpenRouter]"
  design_system: { package: "@vantage/design-system", tag: "v6.11.0", client_logos: false }
  targets: { github: Authority-Solutions/as-sales-app, supabase: pending (john.smith org), vercel: pending }
  registry: { file: screen-registry.json, screens: 36, certified: true }
  milestones:
    - { id: M1, name: Demoable, gate: "5-minute demo: lead arrives, verdict + research, discovery deck generates and presents with the booking slide, zero 404s; isolation probe green; all P1 verified", est: 2026-10-28 }
    - { id: M2, name: Internal GA, gate: "full funnel passes in staging: lead to signed proposal to drafted invoice pair to Lead Won mirror; silence paths move statuses; all P2 verified", est: 2026-11-12 }
  sessions:
    - { id: S0, milestone: M1, arc: foundations, type: onboarding, name: "Onboarding (staff mode: bare machine)", screens: [], deps: [], risk: false, crit: true, routing: { plan: "n/a (checklist)", implement: builder, review: "operator confirms" } }
    - { id: S1, milestone: M1, arc: foundations, type: architecture, name: "Architecture (ADRs + schema first cut)", screens: [], deps: [S0], risk: false, crit: true, routing: { plan: fable, implement: fable, review: "fable + operator" } }
    - { id: S2, milestone: M1, arc: foundations, type: scaffold, name: "Scaffold via new-app.sh + data layer + gstack team mode", screens: [], deps: [S1], risk: false, crit: true, routing: { plan: fable, implement: sonnet, review: "arc gate" } }
    - { id: S3, milestone: M1, arc: foundations, type: design, name: "Design system application + lead-engine contracts", screens: [], deps: [S2], risk: false, crit: true, routing: { plan: fable, implement: "design-system-agent (opus)", review: fable } }
    - { id: S4, milestone: M1, arc: foundations, type: feature-build, name: "Schema + RLS isolation (risk-first)", screens: [], deps: [S3], risk: true, crit: true, routing: { plan: fable, implement: "fable + sonnet", review: "qa-reviewer (opus) per merge" } }
    - { id: S5, milestone: M1, arc: lead-engine, type: feature-build, name: "Auth + shell + state libraries", screens: [login, auth-callback, access-denied, empty-state-library, error-state-library], deps: [S4], risk: false, crit: true, routing: { plan: fable, implement: sonnet, review: "qa-reviewer (opus): auth is risk-scoped" } }
    - { id: S6, milestone: M1, arc: lead-engine, type: integration, name: "GHL connector core + write-back seam", screens: [sync-log], deps: [S4], risk: true, crit: true, routing: { plan: fable, implement: "fable + sonnet", review: "qa-reviewer (opus)" } }
    - { id: S7, milestone: M1, arc: lead-engine, type: feature-build, name: "Leads: list, detail, research briefs, dashboard", screens: [dashboard, lead-list, lead-detail], deps: [S6], risk: false, crit: true, routing: { plan: fable, implement: sonnet, review: "arc gate" } }
    - { id: S8, milestone: M1, arc: lead-engine, type: feature-build, name: "Validation pipeline + suspect queue (arc close)", screens: [suspect-review-queue, validation-log], deps: [S7], risk: true, crit: true, routing: { plan: fable, implement: sonnet, review: "qa-reviewer (opus) arc gate" } }
    - { id: S9, milestone: M1, arc: deck-engine, type: feature-build, name: "Presenton deck generation", screens: [deck-generate, deck-detail, first-value-celebration], deps: [S8], risk: true, crit: true, routing: { plan: fable, implement: sonnet, review: "qa-reviewer (opus): generation pipeline is risk-scoped" } }
    - { id: S10, milestone: M1, arc: deck-engine, type: feature-build, name: "Deck editing, library, booking slide (arc close)", screens: [deck-edit, deck-library], deps: [S9], risk: false, crit: true, routing: { plan: fable, implement: sonnet, review: "qa-reviewer (opus) arc gate" } }
    - { id: S11, milestone: M2, arc: proposal-engine, type: integration, name: "Fathom transcripts", screens: [meeting-recordings], deps: [S10], risk: true, crit: true, routing: { plan: fable, implement: "fable + sonnet", review: "qa-reviewer (opus)" } }
    - { id: S12, milestone: M2, arc: proposal-engine, type: feature-build, name: "Smart Pricing Table proposals", screens: [proposal-generate, proposal-detail, proposal-list], deps: [S11], risk: false, crit: true, routing: { plan: fable, implement: sonnet, review: "qa-reviewer (opus): external API writes are risk-scoped" } }
    - { id: S13, milestone: M2, arc: proposal-engine, type: integration, name: "Signature webhook + Invoice Ninja drafts (arc close)", screens: [invoice-approvals, invoice-pair-detail], deps: [S12], risk: true, crit: true, routing: { plan: fable, implement: "fable + sonnet", review: "qa-reviewer (opus)" } }
    - { id: S14, milestone: M2, arc: pipeline-ops, type: feature-build, name: "Status engine + pipeline board", screens: [pipeline-board, admin-statuses], deps: [S13], risk: false, crit: true, routing: { plan: fable, implement: sonnet, review: "arc gate" } }
    - { id: S15, milestone: M2, arc: pipeline-ops, type: feature-build, name: "Notifications, admin cluster, onboarding (arc close)", screens: [notifications-center, profile-settings, team-reps, admin-integrations, admin-templates, welcome-first-run, command-palette], deps: [S14], risk: false, crit: false, routing: { plan: fable, implement: sonnet, review: "qa-reviewer (opus) arc gate" } }
    - { id: S16, milestone: M2, arc: hardening, type: hardening, name: "Hardening", screens: [], deps: [S15], risk: false, crit: true, routing: { plan: fable, implement: sonnet, review: "qa-reviewer (opus) leads" } }
    - { id: S17, milestone: M2, arc: hardening, type: launch-prep, name: "Launch prep", screens: [], deps: [S16], risk: false, crit: true, routing: { plan: fable, implement: sonnet, review: "fable + operator (milestone gate)" } }
  critical_path: [S0, S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S16, S17]
  risks:
    - { item: "Fathom recording-to-meeting matching is unproven (new requirement, in MVP)", L: 3, I: 4, mitigation: "S11 spikes matching first; manual transcript paste fallback ships in the same session; Zachery specs the API mapping before S11." }
    - { item: "Invoice Ninja two-invoice date logic feasibility unconfirmed", L: 3, I: 4, mitigation: "Scope is draft plus notify only; Zachery chases feasibility before Friday; worst case this is the one manual step and S13 ships notify-only." }
    - { item: "GHL write-back integrity (status mirror drift, duplicate writes)", L: 2, I: 5, mitigation: "Idempotency keys on every write, ghl_sync_log makes the seam visible, S6 proves replay safety against Lee's dev location before anything depends on it." }
    - { item: "Presenton template conversion from the legacy HTML decks", L: 3, I: 3, mitigation: "Mitchell and Zachery deliver enhanced templates by EOD Oct 10; AS Vantage styled placeholders ship in the repo so S9 never blocks on them." }
    - { item: "Smart Pricing Table API credentials not yet in hand", L: 2, I: 3, mitigation: "Zachery obtains before S12; SPT MCP connection already proven on the operator side." }
    - { item: "Deliverability (DNS, SPF, DKIM, DMARC) is the funnel's real critical path and sits outside the app", L: 4, I: 4, mitigation: "Owned by Zachery (Mitchell backup), started now in parallel; tracked on the Friday agenda; no app session depends on it." }
  model_routing: { orchestrator: fable, judgment: opus, execution: sonnet, scans: haiku }
```

## 12. QA & routing summary

QA: test-generator writes contract tests from registry entries before implementation; qa-reviewer (opus) gates every risk-scoped merge and every arc close; the validator, routes_diff, and the Stop-hook guard enforce the registry mechanically; rls-prober re-proves isolation after every migration; gstack `/qa` and `/design-review` gate arcs and milestones in a real browser. Full protocol: `docs/qa-plan.md`.

Routing: Fable orchestrates every session and builds the critical-path subtleties itself; Opus takes judgment (reviews, contracts); Sonnet takes spec-determined implementation; Haiku takes scans; every delegation names its model explicitly and reports in one line. Full map: `docs/model-routing.md`.
