# Handoff: foundations, then the GHL connector, leads and validation

Paste everything below the line into a new Claude Code session opened at the repo root, on a fresh branch from `feat/vantage-reskin` (or from `main` once that branch is merged).

---

You are building the AS Sales App: Authority Solutions' internal sales tool on top of GoHighLevel (GHL). Reps never open GHL; they work leads in this app. The repo today runs mockup screens on sample data, reskinned to the Vantage design system. This session builds the base and the lead engine, in four parts, each a spec in `docs/specs/`:

| Part | Spec                                | What it delivers                                                                                                                                   |
| ---- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `01-foundations.md`                 | Registry machinery, registry routes, Drizzle in and Prisma out, isolation, Inngest and OpenRouter, Google sign-in for provisioned staff, the shell |
| 2    | `06-ghl-connector.md`               | The read side of the connector (import, webhooks, nightly reconcile), the write runner with writes switched off, the sync log                      |
| 3    | `07-leads-research-dashboard.md`    | Lead list, lead detail and dashboard on real leads; the research brief                                                                             |
| 4    | `08-validation-and-review-queue.md` | The validation job and the review queue                                                                                                            |

Do them in order. **Stop after each part**: commit, report what passed and what is outstanding, and wait for the owner's go-ahead before starting the next.

Not in this session: decks (`09`, waiting on the Presenton deploy), meetings (`11`, waiting on the Fathom key), proposals and invoices (`12`, `13`, waiting on Smart Pricing Table and Invoice Ninja access).

## Read first

These are the source of truth; this prompt only adds what they leave out.

- `AGENTS.md`: binding rules. This Next.js version differs from what you know, so read the relevant guide in `node_modules/next/dist/docs/` before writing code.
- `docs/specs/README.md`, then each part's spec in full before starting that part.
- `docs/adr/0001`, `0002`, `0003`, `0006`, `0007`, `0008`, `0009`.
- `docs/packet/build-plan.md` (S1 to S8), `docs/packet/product-doc.md` (sections 4 and 7), `docs/packet/qa-plan.md`, `docs/packet/ghl-workstream.md`, `docs/packet/screen-registry.md`, and the `screen-registry.json` entry of every screen a part builds.
- `GLOSSARY.md` and `DESIGN.md`. The design authority is the Vantage design system in `node_modules/@vantage/design-system` (`docs/RULES.md` is law).
- The build packet's repo package, for the files part 1 copies in: `C:\Users\ajapa\Downloads\AS-Sales-App-build-packet-2026-10-07\_plans\as-sales-app\repo-package\` (`scripts/`, `.claude/agents/`, `.claude/commands/`, `CLAUDE.md`).
- `.env.example` lists every environment variable with its purpose. The owner fills `.env`; never print, log or commit a value from it. Already set by the owner: Supabase, Google sign-in (in Supabase itself), `OPENROUTER_API_KEY`, `GHL_PRIVATE_TOKEN` (read-only). Inngest runs locally, so it needs no keys yet.
- TopicVane (`C:/topicvane/main`), a sibling project, for the local Inngest setup to copy: `src/lib/inngest/client.ts`, `src/lib/inngest/assert-cloud-mode.ts`, `src/app/api/inngest/route.ts`, `.env.development`, the `dev:inngest` script in `package.json`, the `inngest-cli` entry in `pnpm-workspace.yaml`, and the Inngest section of its README. Copy the pattern, not its functions. Read only; change nothing there.

## Part 1: foundations (spec 01)

Each step leaves the app working, the tests green and a commit behind it.

1. **Registry machinery.** Copy the two scripts, the eight agents and the two commands; merge the packet's CLAUDE.md sections into `AGENTS.md`; adapt `rls-prober` and `backend-supabase` to ADR-0007 (guards, default-deny RLS, no policies). Run the scripts with `python` (this machine has no `python3`). Do not turn on the Stop hook yet.
2. **Routes to the registry.** Move the mockups to the registry routes in the spec's route map, under an `(app)` route group, with `src/lib/flags.ts` hiding any link whose destination is not live in production. Delete the role preview and Workspace settings. Update the navigation table, tests and internal links. When `routes_diff.py` shows no built-but-unregistered route, turn on the Stop hook.
3. **Drizzle in, Prisma out.** Schema for the seventeen tables, RLS enabled with no policies in the same migration, `src/db/client.ts`, `db:generate` and `db:migrate`. Before the first migration, put the drafted columns to the owner in one message and wait for a yes. Then remove Prisma, its generated client, config and scripts.
4. **Guards and isolation.** `requireProfile`, `requireAdmin`, `leadScope`, called first by every data-access function. Write both isolation suites failing first, show them failing, then make them pass.
5. **Inngest and OpenRouter.** Inngest runs **locally only** for now, set up as TopicVane does: the `inngest` SDK, `inngest-cli` as a dev dependency allowed to build, `pnpm dev:inngest` (`inngest-cli dev -u http://localhost:3000/api/inngest`) run beside `pnpm dev`, `INNGEST_DEV=1` in a committed `.env.development` and never in `.env.example`, and the guard that refuses `INNGEST_DEV` on a deployed environment. Add a README section saying how to run the two processes. Then the one OpenRouter module: default model from `OPENROUTER_MODEL`, logging model, tokens and cost on every call.
6. **Google sign-in.** `/login`, `/auth/callback`, `/access-denied`, sign-out, the proxy redirect to `/login`, and `pnpm seed:admins`. Google sign-in and the Supabase provider are already set up by the owner. Delete sign-up, password reset and profile setup with their routes, tests and copy. Then remind the owner to turn off "Allow new users to sign up" and the email provider in Supabase.
7. **Shell and state libraries.** Sidebar from the registry's nav gating matrix, admin group omitted for reps; empty states on the kit's `EmptyState` with an explicit variant; `not-found.tsx`, `error.tsx` boundaries and the offline banner.

## Part 2: the GHL connector (spec 06)

Read the spec's "What the account looks like" and "Working without a dev location" first. There is one GHL sub-account and it is production: **a write to it fires Lee's workflows and emails real people.**

- Build against the read-only token (`GHL_PRIVATE_TOKEN`, already in `.env`; the owner's check on 20 October read the pipeline, custom fields, calendars and users, and every id matched spec 06). Send an explicit `User-Agent` on every call: Cloudflare in front of GHL rejects some runtime defaults with 403 "Error 1010". Verify the configured ids at startup, then import, the webhook route, the Inngest jobs that read records back, and the nightly reconcile.
- Build the write runner and W1, W3, W4 (and W2 behind its flag) against a stubbed GHL in tests. `GHL_WRITES_ENABLED` stays `false`; a write that would have been made is logged as skipped. Never set it to `true`, and never create a write-scoped token: the first real writes happen in a session the owner runs with Lee.
- The sync log screen at `/admin/sync-log`.
- Webhooks need a public URL; Lee points them at a deployed preview. Until then, test the handler with recorded payloads.

## Part 3: leads, research and the dashboard (spec 07)

Replace the sample-data bodies of the lead data-access functions with queries on the synced leads (ADR-0006: bodies change, nothing above them), then delete the lead fixtures. The research brief runs as an Inngest job through the OpenRouter module. Use the kit's `DataTable` for the lead list. Spec 07's two open questions stay assumptions behind named constants.

## Part 4: validation and the review queue (spec 08)

The rules file starts from the obvious patterns in the spec, each with a comment, and is refined when the Typeform export arrives. The verdict job, W1 (logged as skipped while writes are off), the review queue on real data and the validation log.

## Rules for every part

- **Open questions:** where a spec says "assumed", build the assumption behind one named constant and say so in a comment. Never invent an answer the spec does not give; ask.
- **Data access** follows ADR-0001, 0002, 0003 and 0006 as the existing code does: zod schema as the contract, one data-access module per entity calling the guard first, Route Handlers validating with the shared schema, TanStack Query hooks for client calls, server prefetch through the data-access function. Copy the pattern in `src/lib/leads/`, `src/lib/data/leads.ts`, `src/app/api/leads/` and `src/hooks/use-leads.ts`.
- **One module per outside service** (`src/lib/services/ghl/`, `llm.ts`, `presenton.ts`, `fathom.ts`). Nothing else calls the service.
- **UI work** follows the design workflow in `AGENTS.md` (`impeccable`, `emil-design-eng`, `apple-design`, then the motion skills, then the review). Vantage components and tokens only; never a raw colour.
- **Credentials:** sign-in is the owner's. Create no accounts in any outside service, create no tokens or keys, and enter no credentials. Ask the owner to sign in when you need to look at a signed-in screen; otherwise verify through tests.
- **Database:** announce which Supabase project a migration targets before running it.
- **Git:** one worktree per parallel task. Conventional commits, lines up to 120 characters, no attribution trailers, hooks never bypassed. Commit after each step; push when the owner asks.

## Done when, for each part

- Every acceptance check in the part's spec passes, or is listed as waiting on a named person (for spec 06, the write checks wait on the session with Lee). The report says which checks were seen in a browser and which only in tests.
- `pnpm format:check`, `pnpm lint`, `pnpm test:run` (five consecutive runs) and `pnpm build` pass.
- `validate_registry.py` passes and `routes_diff.py` is clean.
- The report lists the owner steps still outstanding and every assumption built on, each with its spec and question.
