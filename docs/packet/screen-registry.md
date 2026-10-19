# AS Sales App: Screen Registry

Product: as-sales-app · Owner: Authority Solutions (internal) · Generated: 2026-10-07 · Generator: 1-man-as-saas
**36 entries · CERTIFIED** (block in section 8; `screen-registry.json` is the machine source of truth and the build reference).

## 1. Product context

**Concept:** a sales app stacked on GoHighLevel: reps run the whole funnel (validated leads, research briefs, generated decks, transcript-fed proposals, drafted invoices) without ever touching the CRM. GHL stays the system of record; the app is where humans decide.

**Personas:** `admin` (Zachery, Mitchell: everything plus the admin cluster and invoice approval) · `operator` (sales rep: own funnel surfaces; invoices and recordings read-only; no admin cluster).

### Gating decisions and their impact

| Decision | Locked value | Impact |
|---|---|---|
| Distribution | Internal invite-only (admin provisions; Workspace Google OAuth) | No signup/password/marketing surfaces: saves 8 to 10 screens |
| Workspace model | Single workspace, role-scoped RLS | No org admin, switcher, or workspace CRUD: saves 6 to 8 |
| Pricing | None (internal; M2 = Internal GA) | D3 empty: saves 8 to 10. Invoice Ninja flows are product features, not app billing |
| Reseller | No | Phase 3 empty: saves 10 to 15 |
| Mobile | Responsive desktop-first | Inline reflow notes, no native set |
| AI depth | Autonomous pipelines + approval queues + proposal tweak area | Adds suspect queue (approval), validation log (run log/audit) |
| Compliance | SMB internal | sync-log as the audit surface; no enterprise security cluster |
| Trial / API / i18n | None / None / English | No additions |
| Onboarding | Minimal | One welcome screen + first-value celebration, no wizard cluster |

**Core features:** lead list and validation · research briefs · deck generation (Discovery Call, Follow Up, Strategy Session) · pipeline status tracking · proposal builder · invoice drafting and approval.

**Integrations:** GoHighLevel, Presenton, Smart Pricing Table, Invoice Ninja, Fathom, Typeform, OpenRouter.

## 2. Phase summary

| Phase | Count | Cumulative | Gate test |
|---|---|---|---|
| P1 Demoable (M1) | 12 | 12 | 5-minute demo: lead arrives, verdict + research, discovery deck generates and presents with the booking slide, zero 404s |
| P2 Internal GA (M2) | 19 | 31 | Full funnel in staging: lead to signed proposal to drafted invoice pair to Lead Won mirror; silence paths move statuses |
| P3 White-Label | 0 | 31 | unused (reseller = no) |
| P4 Full Platform | 5 | 36 | backlog, scoped after M2 |

## 3. Phase 1 (Demoable)

| # | Name | Route | Dimension | Tier | RBAC (admin/op) | Purpose |
|---|---|---|---|---|---|---|
| 1 | Login | /login | Auth | 1 | full/full | Workspace-restricted Google sign-in |
| 2 | Auth Callback | /auth/callback | Auth | 2 | full/full | OAuth exchange + provisioning check (handler) |
| 3 | Access Denied | /access-denied | Auth | 2 | full/full | Unprovisioned Workspace member lands here |
| 4 | Dashboard | /dashboard | Reporting | 1 | full/full | KPIs, needs-attention, activity |
| 5 | Lead List | /leads | Core | 1 | full/full | Working surface: verdicts, stages, age |
| 6 | Lead Detail | /leads/[id] | Detail | 1 | full/full | Research, decks, timeline, the GHL seam |
| 7 | Suspect Review Queue | /review-queue | AI Layer | 1 | full/full | Human judgment on suspect verdicts |
| 8 | Generate Deck | /leads/[id]/decks/new | Core | 1 | full/full | Pick group, review inputs, generate |
| 9 | Deck Detail | /decks/[id] | Core | 1 | full/full | Present, share, PDF; booking slide rides last |
| 10 | Empty State Library | (library) | States | 1 | full/full | Variant-correct empties everywhere |
| 11 | Error State Library | (library) | States | 1 | full/full | 404/403/500/offline patterns |
| 12 | First-Value Celebration | (overlay) | Activation | 1 | full/full | First generated deck, once |

**Explicit cuts at P1:** signup/password flows (Google only) · session-expired screen (banner state on login) · onboarding wizard (minimal depth; welcome lands P2).

## 4. Phase 2 (Internal GA)

| # | Name | Route | Dimension | Tier | RBAC (admin/op) | Purpose |
|---|---|---|---|---|---|---|
| 13 | First-Run Welcome | /welcome | Onboarding | 2 | full/full | Three-step orientation, once |
| 14 | Deck Edit | /decks/[id]/edit | Core | 2 | full/full | Structured edits + prompt-driven slide regen |
| 15 | Deck Library | /decks | Core | 2 | full/full | All decks across leads |
| 16 | Pipeline Board | /pipeline | Core | 2 | full/full | GHL stage mirror, silence paths |
| 17 | Generate Proposal | /leads/[id]/proposals/new | Core | 1 | full/full | Transcript + deck context to SPT draft |
| 18 | Proposal Detail | /proposals/[id] | Detail | 1 | full/full | Prompt tweak area, signature tracking |
| 19 | Proposal List | /proposals | Core | 2 | full/full | Signature states and values |
| 20 | Invoice Approvals | /invoices | Core | 1 | full/read-only | Two-invoice drafts: review, approve, send |
| 21 | Invoice Pair Detail | /invoices/[id] | Detail | 2 | full/read-only | Date-logic reasoning before money moves |
| 22 | Meetings & Recordings | /recordings | Integrations | 2 | full/read-only | Fathom matches, transcripts, rematch |
| 23 | Notifications Center | /notifications | Notifications | 2 | full/full | Six core event types |
| 24 | Profile & Preferences | /settings/profile | Personal | 2 | full/full | Name + per-type notification toggles |
| 25 | Rep Management | /admin/reps | Team | 2 | full/hidden | Provision, roles, deactivate |
| 26 | Integrations Health | /admin/integrations | Integrations | 2 | full/hidden | Six connections: status, config, test |
| 27 | Deck Templates | /admin/templates | Integrations | 2 | full/hidden | Three groups, versions, prompt presets |
| 28 | Statuses & Thresholds | /admin/statuses | Workspace | 2 | full/hidden | Status mirror + lead-age tuning |
| 29 | Validation Log | /admin/validation-log | AI Layer | 2 | full/hidden | Every verdict: inputs, cost, overrides |
| 30 | GHL Sync Log | /admin/sync-log | Compliance | 2 | full/hidden | Every write to GHL, the visible seam |
| 31 | Command Palette | (overlay) | Search | 2 | full/full | Cmd-K jump + quick actions |

**Explicit cuts at P2:** global search-results page (palette suffices) · import wizard (Typeform seed is a script) · help center (support is #as_ghl) · Slack/webhook notification config (in-app only; GHL keeps its own alerts).

## 5. Phase 4 backlog

| # | Name | Route | Tier | Why deferred |
|---|---|---|---|---|
| 32 | Loading Skeleton Library | (library) | 2 | Inline skeletons suffice until polish |
| 33 | Reports Hub | /reports | 3 | Needs months of GA data |
| 34 | Admin Analytics | /admin/analytics | 3 | Classifier/funnel tuning surfaces |
| 35 | Invoice Manager (Full) | /invoices/manage | 3 | The named swap path if Mitchell widens invoicing scope |
| 36 | Lead Routing Rules | /admin/routing | 3 | GHL routing is authoritative until reps 2 to 4 |

Also deferred (not screens): GHL custom-field deck push · post-Lead-Won surfaces · milestone celebration series.

## 6. Nav gating matrix

| Nav item | admin | operator |
|---|---|---|
| Dashboard | full | full |
| Leads | full | full |
| Review Queue | full | full |
| Pipeline | full | full |
| Decks | full | full |
| Proposals | full | full |
| Invoices | full | read-only |
| Recordings | full | read-only |
| Notifications | full | full |
| Admin (Reps, Integrations, Templates, Statuses, Logs) | full | hidden |
| Settings (Profile) | full | full |

## 7. State libraries and affordance map

**Libraries:** Empty State Library (P1: variant-correct per DS; copy lives in each screen's `states.empty`) · Error State Library (P1: 404 via not-found.tsx, 403 via access-denied/inline, 500 via error.tsx, offline banner) · Loading Skeleton Library (P4; inline until then).

**Affordance map convention:** shell affordances (notification bell, avatar menu, Cmd-K palette) are listed once on `dashboard` and inherited by every shell screen. The full edge table is the `affordances[]` arrays in `screen-registry.json`; `routes_diff.py` and the registry-auditor treat those arrays as the navigation contract. Phase-gated affordances (P1 screens pointing at P2 destinations) are flagged in `cc_notes` and hidden behind feature flags until their destination ships; this is what keeps the M1 demo 404-free.

## 8. Certification

```
CERTIFICATION | status: certified
Audited: 2026-10-07T12:50 · Frameworks: F1-F5 forward + A1-A7 reverse · Rounds: 2
Counts: 36 screens (12/19/0/5 by phase · 13/19/4 by tier · 3 libraries)
Dangling destinations: 0 · Unresolved RBAC: 0 · Phase-gate simulations: M1 pass, M2 pass
Findings fixed (4):
  - A6 round 1: lead-detail carried affordances to P2 destinations (New proposal, Meeting row, Invoice chip) reachable in the M1 demo; fixed with phase flags in cc_notes so nothing on the screen can 404 at M1
  - A6 round 1: deck-detail breadcrumb targeted deck-library (P2) during the M1 demo; fixed: breadcrumb renders Back to lead until S10, Edit hidden until S10
  - A2 round 1: shell affordances (bell, avatar menu, Cmd-K) were implied on every screen but listed nowhere consistently; convention fixed: listed once on dashboard and recorded in the affordance map as inherited via the shell
  - A4 round 1: dashboard Decks and Proposals KPI tiles target P2 list screens; fixed: feature-flagged until S10/S12 so the M1 demo shows three tiles
Open questions (7):
  - hours_per_week defaulted to 30; Bien confirms at the Friday Oct 10 review call and milestone dates re-derive
  - start_date defaulted to 2026-10-13, the Monday after the review call that starts the build clock
  - Which of the 16 GHL internal alerts become in-app notification types is decided at the Friday call; S15 ships the six core types either way
  - Status set and lead-age thresholds (nurture 14d unbooked, lost after no-show chase, lost 14d silent post-proposal) ship as defaults for Lee to confirm
  - Rep data scope defaulted to own-assigned-leads for reps, all for admins; revisit when rep 2 is provisioned
  - Invoice approver defaulted to admin with rep read-only; Mitchell may widen
  - Deck edit depth: structured slots plus prompt-driven slide regeneration; full WYSIWYG is Phase 4 unless Presenton gives it free
```

## 9. Build order

Full plan: `docs/build-plan.md`. The first feature sessions build, in order: login + auth-callback + access-denied + the two state libraries (S5), sync-log with the connector (S6), dashboard + lead-list + lead-detail (S7), suspect-review-queue + validation-log (S8), deck-generate + deck-detail + first-value-celebration (S9).
