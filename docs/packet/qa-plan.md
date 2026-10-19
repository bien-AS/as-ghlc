# AS Sales App: QA Plan

In a solo build there is no second engineer; **this machinery is the second engineer.** Review is non-optional and mechanical, so quality never depends on Bien remembering to ask.

## Principles

- **Writer/reviewer split, enforced by model boundary.** The model that wrote the code never approves it. Sonnet writes, qa-reviewer (opus) gates, Fable adjudicates disputes. When Fable builds directly (schema, connector, billing-grade flows), qa-reviewer still gates.
- **Risk-scoped gating.** Full qa-reviewer review is mandatory for: schema/migrations, RLS, auth, webhooks and external writes (GHL, SPT, Invoice Ninja), anything `risk:true` or `crit:true`. Routine screen work gates per arc. Milestone gates are Fable-run with Zachery. The economy is written to be kept; a gate the build routes around protects nothing.
- **Test-First per registry screen.** test-generator writes contract tests from the registry entry (data_deps, affordances, states, rbac) before implementation.
- **The registry is the QA baseline, by script.** `routes_diff.py` + `validate_registry.py` run in `/handoff` every session and in the Stop-hook guard continuously.
- **Isolation is re-proven, not assumed.** rls-prober after any migration and at every gate; cross-role leak = stop the line.
- **Review agents are read-only.** qa-reviewer, registry-auditor, rls-prober report; builders fix.
- **The browser is a gate too.** gstack `/qa` at arc closes and milestones; `/design-review` against the Vantage RULES at milestones.
- **One-line routing reports** per delegation (agent · model · scope).

## The QA loop

- **Per Feature Build session:** test-generator first · build · tests green + CI floor (`check:deadclass`, `tsc --noEmit`) · `/handoff`.
- **Per arc close:** qa-reviewer over the arc diff (or `/code-review`), findings fixed, re-gate until clean; gstack `/qa <dev URL>` over the arc's screens.
- **Per migration:** + rls-prober.
- **Per milestone:** full suite + rls-prober + routes_diff + `/qa` over the full gate journey + `/design-review`; Fable runs the gate test with Zachery and writes the gate report to docs/build-log.md.
- **Any bug or unexplained failure:** gstack `/investigate` before fixes.
- **A11y floor:** axe serious/critical = fail, riding the Playwright suite.

## Roster (the eight repo agents, `.claude/agents/`)

| Agent | Model | Runs | Read-only | Failing looks like |
|---|---|---|---|---|
| saas-orchestrator | fable | when Bien delegates a whole arc | no | arc brief misses a registry screen |
| design-system-agent | opus | S3 + per-arc contracts | writes docs/design only | invented tokens, dark: variants |
| frontend-builder | sonnet | screen implementation | no | contract/registry disagreement unreported |
| backend-supabase | sonnet | schema, RLS, Inngest, APIs | no | ad-hoc DDL, unannounced ref |
| qa-reviewer | opus | arc closes + risk merges | yes | a FAIL with findings by severity |
| registry-auditor | sonnet | session end, arc close, gates | yes | BUILT-BUT-UNREGISTERED (always fail) |
| rls-prober | sonnet | after migrations + gates | executes probes only | any probe leak (stop the line) |
| test-generator | sonnet | start of every Feature Build | writes tests only | registry entry too vague to test (registry defect) |

Model fields use family aliases; an unavailable pinned model silently falls back to the session model, which is exactly the waste and risk aliases avoid.

## Mechanical enforcement

- **Stop hook** (`.claude/settings.json`): blocks ending a coding turn with built-but-unregistered routes or a certified registry failing validation.
- **`/handoff`**: the seven-step ritual; prints validator + routes_diff output.
- **`--emit-cert`**: the only writer of certification counts; stale counts are a validator error.
- **gstack team mode (`required`)**: any clone without gstack is blocked from AI-assisted work in the repo; a genuine outage uses the manual-equivalent + `DEGRADED` build-log line, never routine bypass.

## Failure protocols

- **STOP-THE-LINE** (role-boundary leak in a probe, cross-role read, secret in code, unverified inbound webhook accepted): halt, fix, add a regression test, log in build-log.
- **REGISTRY DRIFT** (route exists the registry lacks, or vice versa): register or reconcile before the session closes; a whole new feature cluster gets a mini F1+F2 pass first.

## This product's hot spots (review here first)

1. **The GHL write path** (S6): idempotency, replay, the seam log complete. A duplicate stage write triggers duplicate client emails in Lee's workflows.
2. **Webhook ingress** (GHL inbound, SPT signature, Invoice Ninja events): signature verification on every one; S16 tests replay and forgery.
3. **Role boundary** (admin vs rep): rep must never read another rep's leads or act on invoices; the S4 probe suite covers every business table.
4. **Money surfaces** (invoice drafts): amounts render only from synced Invoice Ninja state; date logic shown in words before approval.
5. **LLM pipelines** (verdicts, research, decks, tweaks): every run logged with cost; CostPreview in front of spend; null means not measured, never zero.

## What Zachery personally reviews

Fable's milestone gate reports · any contested qa-reviewer FAIL · all ADRs · every stack-deviation Decisions entry. The human stays the final gate on judgment even when the machinery is green; this is exactly the operator's oversight surface while Bien builds.
