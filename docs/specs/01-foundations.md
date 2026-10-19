---
title: Foundations on this repo
status: ready
sessions: S1, S2, S3, S4, S5 (packet build plan, adapted by ADR-0007)
registry: login, auth-callback, access-denied, empty-state-library, error-state-library
waiting_on: []
done_by_owner:
  - Google OAuth client created and the Google provider switched on in Supabase (checked 20 October)
  - Supabase test org and the team's Vercel access
---

# 01. Foundations on this repo

**Purpose:** turn this repo, which today runs mockups on sample data, into the base the packet's feature sessions build on: the packet's stack, its screen registry and QA machinery, registry routes, the data model with isolation proven, and Google sign-in for provisioned staff. Nothing here is a feature a rep sees except the sign-in.

Read first: `docs/packet/build-plan.md` (S1 to S5), `docs/packet/product-doc.md` sections 4 and 7, `docs/packet/qa-plan.md`, ADR-0002, ADR-0007, ADR-0008, ADR-0009.

## What exists, and what happens to it

| Today                                                                               | Becomes                                                                                                              |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Prisma 7, one `User` model, one migration                                           | Drizzle: `src/db/schema.ts`, SQL migrations in `drizzle/`. Prisma, its config, scripts and `generated/` are removed. |
| Email and password sign-in, sign-up, password reset, profile setup (ADR-0004, 0005) | Google sign-in only (ADR-0008). Sign-up, reset and profile setup are deleted.                                        |
| Routes under `/dashboard/...`                                                       | The registry's routes (table below).                                                                                 |
| Owner, Admin and Staff role preview on sample data                                  | Two roles, `admin` and `rep`, from `profiles.role`. The role preview is deleted.                                     |
| Workspace settings screen                                                           | Deleted: one workspace, nothing to set.                                                                              |
| Sample data behind the real data path (ADR-0006)                                    | Kept until the GHL connector (spec 06) supplies real leads, then the fixtures are deleted.                           |
| Vantage reskin, `/dev/vantage`                                                      | Kept. `DESIGN.md` is rewritten to point at Vantage (see Design).                                                     |

### Route map

| Registry screen      | Route                      | From today's                                            |
| -------------------- | -------------------------- | ------------------------------------------------------- |
| login                | `/login`                   | `/sign-in` (rebuilt: one Google button)                 |
| auth-callback        | `/auth/callback` (handler) | same path, new checks                                   |
| access-denied        | `/access-denied`           | new                                                     |
| dashboard            | `/dashboard`               | new home (spec 07); the Pipeline list moves to `/leads` |
| lead-list            | `/leads`                   | `/dashboard` (Pipeline)                                 |
| lead-detail          | `/leads/[id]`              | `/dashboard/leads/[leadId]`                             |
| suspect-review-queue | `/review-queue`            | `/dashboard/suspects/[[...leadId]]`                     |
| deck-detail          | `/decks/[id]`              | `/dashboard/deck-presenter?lead=`                       |
| proposal-detail      | `/proposals/[id]`          | `/dashboard/proposal-builder?lead=`                     |
| notifications-center | `/notifications`           | `/dashboard/notifications`                              |
| profile-settings     | `/settings/profile`        | `/dashboard/account`                                    |
| team-reps            | `/admin/reps`              | `/dashboard/users`                                      |
| admin-integrations   | `/admin/integrations`      | `/dashboard/integrations`                               |

Screens are grouped under an `(app)` route group with the shell layout; `/login`, `/auth/callback` and `/access-denied` sit outside it. A mockup moved to a registry route keeps its sample data until its own session replaces it, and its sidebar entry stays hidden in production until then (see Phase flags).

## 1. Stack (S2)

- **Drizzle** with `drizzle-kit`. Schema in `src/db/schema.ts`, one client in `src/db/client.ts` using the pooled `DATABASE_URL`; migrations generated, read, then applied with `DIRECT_URL`. `pnpm db:generate`, `pnpm db:migrate`.
- **Inngest** for every background job: one client, one serve route at `/api/inngest`, functions under `src/inngest/`. Local runs use the Inngest dev server.
- **OpenRouter** for every model call, through one module (`src/lib/services/llm.ts`). Each call logs model, tokens and cost; cost is `null` until known, never 0.
- **Environment:** add `OPENROUTER_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, and the GHL, Presenton, Fathom, SPT and Invoice Ninja variables as their specs need them. `.env.example` lists every name with a one-line purpose; `.env` stays out of git.

## 2. Registry and QA machinery (S2)

- `screen-registry.json` at the repo root is the answer to "what screens exist". A screen not in it is not built; a gap found mid-build is registered first. `docs/packet/screen-registry.md` is its readable copy.
- Copy from the packet: `scripts/validate_registry.py`, `scripts/routes_diff.py`, `.claude/agents/*` (eight), `.claude/commands/session.md` and `handoff.md`. Merge the packet's CLAUDE.md sections into `AGENTS.md`.
- **Windows:** the scripts and the Stop hook call `python3`, which this machine does not have. Use `python` in the hook command (both work on the CI image), or run under WSL. Decide once and record it in `AGENTS.md`.
- **Adapt two agents** to ADR-0007: `rls-prober` checks RLS is on with no policies (default-deny) and runs the isolation suites in section 4; `backend-supabase` writes data-access guards, not policies.
- Turn the Stop hook on only once `routes_diff.py` is clean, so it does not block every turn during the rename.
- gstack team mode waits until gstack is confirmed working on Windows (talking points, section 4).

## 3. Phase flags

The registry forbids a P1 screen linking to a P2 destination that would 404 during the M1 demo. One module, `src/lib/flags.ts`, says which registry screens are live. A link, tile or sidebar entry whose destination is not live is not rendered. A mockup on sample data counts as not live in production and live in development.

## 4. Data model and isolation (S4)

The packet's seventeen tables (`docs/packet/product-doc.md`, section 7), in Drizzle, every one with `created_at` and `updated_at`, soft delete (`deleted_at`) on `leads` and `decks`:

`profiles` · `leads` · `lead_research` · `validation_runs` · `lead_status_events` · `status_defs` · `decks` · `deck_templates` · `meetings` · `transcripts` · `proposals` · `proposal_revisions` · `invoices` · `notifications` · `ghl_sync_log` · `integration_connections` · `app_settings`

Rules the schema keeps:

1. `profiles.id` is the Supabase auth user id (ADR-0008). Columns: email (unique, lowercase), first and last name, `role` (`admin` or `rep`), `active`, `ghl_user_id` (nullable), `first_run`, `celebration_shown`, notification preferences.
2. `leads` carry `ghl_contact_id` and `ghl_opportunity_id`, both unique; `assigned_to` (a profile, nullable while GHL assigns the placeholder user); `stage` and `lead_status` as GHL names them (spec 06); `last_activity_at`.
3. Every GHL write has a `ghl_sync_log` row: write type, lead, idempotency key (unique), payload, result, attempt count, last error.
4. `lead_status_events` and `validation_runs` are append-only.
5. Secrets are never stored in a table. `integration_connections` holds non-secret config and health only.
6. **RLS is enabled on every table with no policies** (default-deny), in the same migration that creates the table.

The model's exact columns are drafted at S1 from the registry's `data_deps` and reviewed before the first migration.

**Guards** (ADR-0002), in the data-access layer, called first by every function: `requireProfile()` (a verified session and an active profile), `requireAdmin()`, and `leadScope(profile)`, which every lead query applies: an admin sees every lead, a rep only leads with `assigned_to` equal to their id. Nothing that belongs to a lead (research, decks, meetings, proposals, invoices) is read without going through the lead's scope.

**Isolation suites**, written failing first:

- Data-access suite (Vitest, real test database, three seeded profiles: one admin, rep A, rep B): for every function that reads or writes lead-owned data, rep A cannot read or change rep B's rows; a rep cannot act on invoices; a deactivated profile is refused everywhere.
- Database check: as the `anon` and `authenticated` roles, every business table returns zero rows and refuses writes.

## 5. Sign-in (S5)

Per ADR-0008.

- `/login`: the Authority Solutions logo, one "Continue with Google" button, and the theme switch. Google is called with `hd=authoritysolutions.com` and `prompt=select_account`.
- `/auth/callback` (a Route Handler): exchanges the code; then requires a verified email ending in `@authoritysolutions.com`, an existing profile with that id, and `active = true`. On success: to the remembered page if it is a path inside the app, else `/welcome` when `first_run`, else `/dashboard`. On any failure: sign out, then `/access-denied` with the reason.
- `/access-denied`: says which check failed in plain words ("This Google account is not an Authority Solutions address", "Your account has not been set up yet. Ask Zachery or Mitchell to add you", "Your access has been turned off"), and offers "Use a different account", which signs out first.
- The proxy keeps redirecting signed-out visitors to `/login`, remembering the page. Every page and Route Handler under `(app)` is guarded on the server; the proxy is not the control.
- **Seed:** `pnpm seed:admins` creates the auth users and admin profiles for the emails in `SEED_ADMIN_EMAILS`. Provisioning from the screen is spec 15.
- Sign-out stays in the user menu.

**Owner steps, not code:** the Google OAuth client and Supabase's Google provider are done. Still to do: add `http://localhost:3000/auth/callback` and each deployed callback to Supabase's redirect allow-list, and, once Google sign-in has shipped, turn off "Allow new users to sign up" and the email provider in Supabase. With sign-ups off, only the auth users that provisioning creates can sign in, even with a company Google account.

## 6. Shell and state libraries (S5)

- The sidebar follows the registry's nav gating matrix: Dashboard, Leads, Review Queue, Pipeline, Decks, Proposals, Invoices, Recordings, Notifications; an Admin group (Reps, Integrations, Templates, Statuses, Logs) for admins only, omitted from the DOM for reps. Profile settings from the user menu. Only live screens appear (section 3).
- **Empty states:** one pattern on the kit's `EmptyState`, whose `variant` (empty, filtered, not connected) is always explicit. Copy per screen comes from the registry's `states.empty`.
- **Errors:** `not-found.tsx` for 404; `/access-denied` for auth refusals and an inline "You do not have access" for a role-gated fetch (403); `error.tsx` boundaries for 500 with a retry; an offline banner from the browser's connectivity events.

## Design

`DESIGN.md` is rewritten: the authority is the Vantage design system (`node_modules/@vantage/design-system/docs/RULES.md`); the file records only what this app adds (the token mapping in `globals.css`, the sidebar's dark chrome, the components in `src/components/ui`) and the decisions from the 14 October design review. UI work follows the design workflow in `AGENTS.md`.

## Acceptance checks

1. `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm test:run` pass; no Prisma package or import remains.
2. `python scripts/validate_registry.py screen-registry.json` passes and `routes_diff.py` lists no built-but-unregistered route.
3. A fresh database migrates from empty; every business table has RLS on and no policy.
4. Both isolation suites pass, and each was seen failing before the guard or the RLS switch existed.
5. A provisioned, active `@authoritysolutions.com` Google account signs in and lands on `/dashboard` (or `/welcome` on first run).
6. A non-company Google account, an unprovisioned company account and a deactivated account each end signed out on `/access-denied` with the right reason, and none can call any `/api` route.
7. A rep sees only their own leads on every list and detail route; an admin sees all; the admin sidebar group is absent from a rep's DOM.
8. `/sign-up`, `/reset-password`, `/profile-setup`, `/dashboard/settings` and the role preview no longer exist.
9. No component, hook or Route Handler imports a fixture (ADR-0006 check).
10. Nothing on a P1 screen links to a route that is not live.

## Out of scope

The GHL connector (spec 06) and every feature screen. Provisioning reps from the screen (spec 15). gstack team mode and the CI floor's `check:deadclass` (wired when gstack is confirmed on Windows). Moving the repo to the org (the owner does it).
