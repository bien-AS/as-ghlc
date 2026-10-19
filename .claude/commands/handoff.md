---
description: Run the session-end handoff ritual
---

Run the handoff ritual, steps in order, showing output for 2 and 3. If anything fails, fix it before declaring the session closed.

1. Commit all changes. No uncommitted work survives a session boundary.
2. `python scripts/validate_registry.py screen-registry.json` passes; registry `status` advanced for everything that shipped; if the registry changed, re-run `--emit-cert` and paste the fresh block into docs/packet/screen-registry.md §8.
3. `python scripts/routes_diff.py` clean: no built-but-unregistered routes.
4. Test suite green, plus the CI floor: `pnpm test:run`, `pnpm lint`, `pnpm format:check`, `pnpm exec tsc --noEmit` (`check:deadclass` once it is wired, spec 01).
5. Update STATUS.md (a session that changed things but left no STATUS.md trail is unfinished); append any new decision, convention, or gotcha to AGENTS.md.
6. Write TODO.md: exactly what the next session starts with and where things stand.
7. Append the one-line session log to docs/build-log.md (session id · what shipped · routing notes).

An interrupted session still executes 1, 5, 6, 7 before stopping. Finish by printing the build-log line and the TODO.md pointer.
