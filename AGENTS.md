<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working rules

- **Commits/PRs:** never add `Co-authored-by` trailers or "Generated with" attribution. Conventional commits, lines ≤ 120 chars (commitlint enforces both).
- **Parallel work:** one git worktree per parallel task; never share a working tree between agents.
- **API:** every handler checks authentication, then ownership of the resource, via the shared guards in the data-access layer (not inline). Validate all input with zod.
- **Data fetching:** client calls live in custom TanStack Query hooks, never inline in components. See `docs/adr/`.
- **Database:** Drizzle (ADR-0007).
- **Product:** the build packet in `docs/packet/` and the screen registry (`screen-registry.json`) define what is built; specs in `docs/specs/` say how.
- **Components:** always look for opportunities to extract reusable components (sidebars, navbars, and the like) into `src/components/ui` rather than leaving them inline in a page.

## The Screen Registry is law

`screen-registry.json` (36 entries, certified) is the single answer to "what screens does this app have". Register before build: a screen not in the registry does not get built; a gap found mid-build is added to the registry first (full fields, phase, tier, rationale), then built. A whole new feature cluster gets a mini F1+F2 pass before its sessions are planned. Routes in code match registry routes (`scripts/routes_diff.py` checks it). Advance `status` (planned, built, verified) as screens ship. `/handoff` every session end; re-run `--emit-cert` after any registry change.

## Build plan

`docs/packet/build-plan.md`, adapted by ADR-0007 and the specs in `docs/specs/`. Current session: the spec being worked (`docs/specs/`, whose `sessions:` frontmatter names the packet sessions it covers) and the last session's commit and report, per `docs/agents/handoff-foundations.md`. Sessions are scope units in six arcs; merging in a sitting is normal, each merged session is still named in the commit and report; **IDs are never renumbered** (insert as S8b). Handoff protocol: commit everything, validator + routes_diff clean, tests + CI floor green, then a report of what passed, what is outstanding (owner steps, assumptions built on) and where the next session starts. Lee's GHL lane: `docs/packet/ghl-workstream.md`; S6, S10, S13, S14 name their Lee dependencies.

## QA loop

`docs/packet/qa-plan.md`. test-generator before every Feature Build; qa-reviewer (opus) gates risk-scoped merges (schema, RLS, auth, webhooks, external writes) and arc closes; rls-prober after every migration (RLS on with no policies, plus the two isolation suites of spec 01 section 4). STOP-THE-LINE: a cross-role probe leak, a data-access function without its guard, a secret in code, or an unverified inbound webhook halts everything, gets fixed with a regression test, and is logged. gstack team mode (`/qa` at arc closes, `/qa` + `/design-review` at gates, `/investigate` on any bug, `/cso` at S16) waits until gstack is confirmed working on Windows (spec 01).

## Model routing

`docs/packet/model-routing.md`. Fable orchestrates and builds critical-path subtleties; Opus judges (qa-reviewer, design contracts); Sonnet implements spec-determined work; Haiku scans. Every Agent call passes an explicit model (family aliases only); report routing in one line per delegation (agent · model · scope).

## Commands

- **Python:** this machine has `python`, not `python3`. The scripts, the agents, `/handoff` and the registry Stop hook all call `python` (it works on the CI image too). The Stop hook in `.claude/settings.json` runs `python scripts/routes_diff.py --guard && python scripts/validate_registry.py screen-registry.json --guard`.
- Registry: `python scripts/validate_registry.py screen-registry.json` · `python scripts/routes_diff.py`.
- Stop hook (packet `.claude/settings.json`), **not enabled yet**: spec 01 turns it on once `routes_diff.py` lists no built-but-unregistered route. Its command: `python scripts/routes_diff.py --guard && python scripts/validate_registry.py screen-registry.json --guard`.
- Dev server: `pnpm dev` · Tests: `pnpm test`, `pnpm test:run` · Lint/format: `pnpm lint`, `pnpm format:check` · Migrate (after spec 01 moves to Drizzle): edit `src/db/schema.ts`, `pnpm db:generate`, read the SQL, `pnpm db:migrate` with the ref announced · CI floor: `pnpm exec tsc --noEmit` (`check:deadclass` once gstack is wired) · `/session <id>` loads a session's full context · `/handoff` runs the session-end ritual.

## Gotchas (sessions append here)

- Supabase org: verify org id `yjfcrhncmqvyqtwinjyx` (john.smith). The ray.smith account owns a decoy org with the same name; it 403s at deploy, not at list.
- Commit email must match the Vercel account email or deploys silently block.
- `.env.local` values single-quoted (unquoted `$` or spaces silently truncate).
- px for prose-bearing widths; `min-w-0` on flex children.
- `cn()` on every className (DS-configured merger; the stock one drops colors).
- `null` means not measured, never zero: lead ages, proposal values, run costs.
- Charts need `useChartTokens()` + client-side import; no `dark:` variants on token-styled components.
- Every GHL write goes through the one idempotent write path and lands in `ghl_sync_log`; never call the GHL API from anywhere else.
- Mutating modals preview the GHL write they cause (the seam principle from the prototype).

## Design workflow

For any UI work, invoke these skills in order:

1. **Direction:** `impeccable` to design the interface, with `design-taste-frontend` for inspiration.
2. **Principles:** `emil-design-eng` for design advice and `apple-design` for principles, while building.
3. **Motion:** `find-animation-opportunities` to decide what should animate, then `animate` to build each animation from scratch.
4. **Review:** check the finished UX against `emil-design-eng` and `apple-design` before calling it done.

## Agent skills

### Issue tracker

GitHub Issues on the current `origin` remote, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
