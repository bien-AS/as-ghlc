---
description: Run the session-end handoff ritual
---

Run the handoff ritual, steps in order, showing output for 2 and 3. If anything fails, fix it before declaring the session closed.

1. Commit all changes. No uncommitted work survives a session boundary.
2. `python scripts/validate_registry.py screen-registry.json` passes; registry `status` advanced for everything that shipped; if the registry changed, re-run `--emit-cert` and paste the fresh block into docs/packet/screen-registry.md §8.
3. `python scripts/routes_diff.py` clean: no built-but-unregistered routes.
4. Test suite green, plus the CI floor: `pnpm test:run`, `pnpm lint`, `pnpm format:check`, `pnpm exec tsc --noEmit` (`check:deadclass` once it is wired, spec 01).
5. Append any new decision, convention, or gotcha to AGENTS.md.
6. Report, per docs/agents/handoff-foundations.md: the spec and session ids worked, the commit hashes, which acceptance checks passed (seen in a browser or only in tests), what is outstanding (owner steps, assumptions built on, each with its spec), and where the next session starts. Then wait for the owner's go-ahead.

An interrupted session still executes 1, 5 and 6 before stopping.
