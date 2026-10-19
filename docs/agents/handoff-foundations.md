# Handoff: build the foundations (spec 01)

Paste everything below the line into a new Claude Code session opened at the repo root, on a fresh branch from `feat/vantage-reskin` (or from `main` once that branch is merged).

---

You are building the AS Sales App: Authority Solutions' internal sales tool on top of GoHighLevel. Reps never open GoHighLevel; they work leads in this app. This session turns the repo, which today runs mockup screens on sample data, into the base every feature session builds on. Your scope is **spec 01, Foundations** (`docs/specs/01-foundations.md`), which covers the packet's sessions S1 to S5 as adapted to this repo.

## Read first

Read these before planning. They are the source of truth; this prompt only adds what they leave out.

- `AGENTS.md`: binding rules. This Next.js version differs from what you know, so read the relevant guide in `node_modules/next/dist/docs/` before writing code.
- `docs/specs/README.md`, then `docs/specs/01-foundations.md` in full.
- `docs/adr/0002`, `0003`, `0006`, `0007`, `0008`, `0009`.
- `docs/packet/build-plan.md` (S1 to S5), `docs/packet/product-doc.md` (sections 4 and 7), `docs/packet/qa-plan.md`, `docs/packet/screen-registry.md`, and `screen-registry.json` entries for `login`, `auth-callback`, `access-denied`, `empty-state-library`, `error-state-library`.
- `GLOSSARY.md` and `DESIGN.md`. The design authority is the Vantage design system in `node_modules/@vantage/design-system` (`docs/RULES.md` is law).
- The build packet's repo package, for the files to copy in: `C:\Users\ajapa\Downloads\AS-Sales-App-build-packet-2026-10-07\_plans\as-sales-app\repo-package\` (`scripts/`, `.claude/agents/`, `.claude/commands/`, `CLAUDE.md`).

## What to build, in order

Each step leaves the app working, the tests green and a commit behind it.

1. **Registry machinery.** Copy the two scripts, the eight agents and the two commands; merge the packet's CLAUDE.md sections into `AGENTS.md`; adapt `rls-prober` and `backend-supabase` to ADR-0007 (guards, default-deny RLS, no policies). Run `validate_registry.py` and `routes_diff.py` with `python` (this machine has no `python3`) and record the result. Do not turn on the Stop hook yet.
2. **Routes to the registry.** Move the mockup screens to the registry routes in the spec's route map, under an `(app)` route group, with `src/lib/flags.ts` hiding any link whose destination is not live in production. Delete the role preview and Workspace settings. Update the navigation table, the tests and every internal link. `routes_diff.py` should then show no built-but-unregistered route; turn on the Stop hook.
3. **Drizzle in, Prisma out.** Schema for the seventeen tables, RLS enabled with no policies in the same migration, `src/db/client.ts`, scripts `db:generate` and `db:migrate`. Before the first migration, put the drafted columns to the owner in one message and wait for a yes. Then remove Prisma and its generated client, config and scripts.
4. **Guards and isolation.** `requireProfile`, `requireAdmin`, `leadScope`, called first by every data-access function. Write both isolation suites failing first, show them failing, then make them pass.
5. **Inngest and OpenRouter.** The Inngest client and `/api/inngest` route; the one OpenRouter module, logging model, tokens and cost on each call. No feature jobs yet.
6. **Google sign-in.** `/login`, `/auth/callback`, `/access-denied`, sign-out, the proxy redirect to `/login`, and `pnpm seed:admins`. Delete sign-up, password reset and profile setup with their routes, tests and copy.
7. **Shell and state libraries.** Sidebar from the registry's nav gating matrix, admin group omitted for reps; empty states on the kit's `EmptyState` with an explicit variant; `not-found.tsx`, `error.tsx` boundaries and the offline banner.

## Rules for this session

- **Open questions:** where the spec says "assumed", build the assumption behind one named constant and say so in a comment. Do not invent answers the spec does not give; ask.
- **Data access** follows ADR-0001, 0002, 0003 and 0006 exactly as the existing code does: zod schema as the contract, one data-access module per entity calling the guard first, Route Handlers validating with the shared schema, TanStack Query hooks for client calls, server prefetch through the data-access function. Copy the pattern in `src/lib/leads/`, `src/lib/data/leads.ts`, `src/app/api/leads/` and `src/hooks/use-leads.ts`.
- **Sample data stays** behind the real data path until spec 06 replaces it. No component, hook or Route Handler imports a fixture.
- **UI work** follows the design workflow in `AGENTS.md` (`impeccable`, `emil-design-eng`, `apple-design`, then the motion skills, then the review). Use Vantage's components and tokens; never a raw colour.
- **Credentials:** sign-in is the owner's. Create no accounts in any outside service and enter no credentials; ask the owner to sign in when you need to look at a signed-in screen, and verify signed-in behaviour through tests otherwise. The Google OAuth client and the Supabase provider settings are owner steps (spec 01, section 5): list them, do not attempt them.
- **Database:** announce which Supabase project a migration targets before running it, and never run against a project not listed in `docs/packet/AS-CONNECTIONS.md` or `.env`.
- **Git:** one worktree per parallel task. Conventional commits, lines up to 120 characters, no attribution trailers, hooks never bypassed. Commit after each step; push when the owner asks.

## Done when

- Every acceptance check in `docs/specs/01-foundations.md` passes, and the final report says which ones were checked in a browser and which only by tests.
- `pnpm format:check`, `pnpm lint`, `pnpm test:run` (five consecutive runs) and `pnpm build` pass.
- `validate_registry.py` passes and `routes_diff.py` is clean, with the Stop hook on.
- The final report lists the owner steps still outstanding and every assumption you built on, each with the spec and question it belongs to.

The next session after this one is spec 06, the GHL connector, which is blocked until Lee hands over the dev location.
