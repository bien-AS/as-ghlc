# AS Sales App: Model Orchestration Map

Bien runs a **Max subscription** with full Fable / Opus / Sonnet / Haiku orchestration. Per-token price is not the lever. The levers are capability fit per task class and the pool economy: **Fable bills against its own weekly pool, separate from the all-models pool.** Routing execution down to Sonnet/Haiku keeps both pools draining in step instead of the Fable pool burning on typing while the shared pool idles.

## The routing table

| Lane | Model | Work class | Invocation |
|---|---|---|---|
| **Orchestrator + builder** | Fable 5 | Session-level: plans, decomposes, briefs, delegates, judges disputes, runs milestone gates. **Builds directly** on critical path and high subtlety: S1 architecture, S4 schema + RLS design, S6 connector write path, S11 Fathom matching, S13 invoice date logic | the session itself (`/model fable`) |
| **Judgment** | Opus | qa-reviewer (risk-scoped merges, arc gates), design-system-agent (S3 + contracts), ad-hoc deep analysis | agent frontmatter; explicit `model` on ad-hoc calls |
| **Execution** | Sonnet | frontend-builder, backend-supabase, test-generator, registry-auditor, rls-prober: spec-determined work | agent frontmatter `model: sonnet` |
| **Volume reads** | Haiku | repo scans, inventories, log/test summarization, find-usages | explicit `model: haiku` per call |

**Every Agent call passes an explicit model.** Unspecified subagents inherit the session model (Fable), which is exactly the waste this table exists to stop.

## Routing rules

1. **Fable never types what Sonnet can type.** If the registry entry + tests fully determine the outcome, delegate it.
2. **Fable always does what only Fable should do.** Architecture, ambiguous decomposition, contested FAILs, milestone gates. Delegating judgment to save tokens is false economy.
3. **Builder-as-needed trigger:** Fable builds directly when (a) the session is Architecture or a gate, (b) the task is critical path AND a Sonnet miss cascades (schema, RLS, the GHL write path, invoice logic), or (c) two builder round-trips failed.
4. **The Fable sandwich is the default for risky features:** Fable writes the brief + acceptance criteria, Sonnet implements, qa-reviewer gates, Fable ships the outcome.
5. **Escalation ladder:** Sonnet misses twice, an Opus analysis call diagnoses, Fable builds it directly. Never a third Sonnet loop on the same miss. Still contested: Zachery.
6. **De-escalation:** scan output needing re-reads means the brief was vague: fix the brief, not the model.
7. **Gate economy is risk-scoped, not per-merge** (see qa-plan.md).
8. **One-line routing reports** per delegation (agent · model · scope).
9. **Write the brief before delegating; one round-trip is the target.**

## Mechanical configuration

- Session model: `/model fable`, every session.
- Per-agent models: the `model:` frontmatter in the eight repo agents (shipped pre-set); the Agent tool's `model` parameter for ad-hoc calls.
- **Use family aliases (`fable`, `opus`, `sonnet`, `haiku`), never pinned version IDs.** Aliases resolve to the current model in each family; pinned IDs go stale and, worse, **an unavailable pinned model silently falls back to the session model**: on a Fable session your "cheap" scan quietly runs on Fable.
- S0 sanity check: one Haiku scan + one Sonnet build task; confirm each result reports the intended model.

## Per-session routing defaults

| Session | plan | implement | review | scans |
|---|---|---|---|---|
| S0 | n/a (checklist) | Bien | Zachery confirms | n/a |
| S1 | fable | fable | fable + Zachery (ADRs) | haiku |
| S2 | fable | sonnet | arc gate | haiku |
| S3 | fable | design-system-agent (opus) | fable | haiku |
| S4 | fable | fable + sonnet | qa-reviewer per merge | haiku |
| S5 | fable | sonnet | qa-reviewer (auth) | haiku |
| S6 | fable | fable + sonnet | qa-reviewer | haiku |
| S7 | fable | sonnet | arc gate | haiku |
| S8 | fable | sonnet | qa-reviewer arc gate | haiku |
| S9 | fable | sonnet | qa-reviewer | haiku |
| S10 | fable | sonnet | qa-reviewer arc gate + M1 gate | haiku |
| S11 | fable | fable + sonnet | qa-reviewer | haiku |
| S12 | fable | sonnet | qa-reviewer | haiku |
| S13 | fable | fable + sonnet | qa-reviewer arc gate | haiku |
| S14 | fable | sonnet | arc gate | haiku |
| S15 | fable | sonnet | qa-reviewer arc gate | haiku |
| S16 | fable | sonnet | qa-reviewer leads; /code-review ultra optional | haiku |
| S17 | fable | sonnet | fable + Zachery (M2 gate) | haiku |

## Pool-health checkpoints

At each milestone, glance at the usage view: Fable pool draining materially faster than the all-models pool means Fable is doing execution work (audit the routing lines, push more to builders). All-models pool hot with quality suffering means under-specified briefs (improve briefs before upgrading lanes). Target: both pools pacing together across the week.
