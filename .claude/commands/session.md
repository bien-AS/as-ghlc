---
description: Start build session $ARGUMENTS with full context
---

Start build session $ARGUMENTS. In order:

1. Read AGENTS.md, TODO.md, and the last 5 lines of docs/build-log.md.
2. Read this session's entry in docs/packet/build-plan.md and in the docs/specs/ file whose `sessions:` names it (id $ARGUMENTS): goal, inputs, outputs, deps, dod, routing.
3. Read every registry entry in the spec's `registry:` list from screen-registry.json, in full (data_deps, affordances, states, rbac, cc_notes).
4. Confirm the session's routing lanes and arc; state them in one line. If the session is a Feature Build, run `test-generator` (sonnet) on those screens FIRST, before implementation.
5. If this session has a Lee dependency (docs/packet/ghl-workstream.md names S6, S10, S13, S14), confirm the owed input exists before starting; if missing, say so and stop.
6. Begin. One session at a time; merging sessions into one sitting is fine, but each merged session still gets its own build-log line, and IDs are never renumbered.
