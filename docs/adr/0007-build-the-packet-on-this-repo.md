---
status: accepted
---

# Build the AS Sales App packet on this repo, with four stack deviations

The 7 October build packet (`docs/packet/`) is the product: an internal Authority Solutions tool on top of GoHighLevel, one workspace, admin and rep, 36 registered screens. It assumes a new repo cut from `vantage-next-starter`. We build it here instead, because sign-in, the shell and three screens already work and were reskinned to the Vantage design system on 14 October. The owner decided this on 14 October; Zachery reviews it as a stack-deviation entry.

Everything in the packet holds except these four points:

| Packet                                       | Here                                                                                                | Why                                                                                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next 14, React 18, Tailwind 3 (the starter)  | Next 16, React 19, Tailwind 4                                                                       | The app already runs on them. The Vantage kit's tokens and components were shown to work on this stack (`/dev/vantage`).                                                                                |
| npm                                          | pnpm                                                                                                | Already set up. No effect outside the repo.                                                                                                                                                             |
| Role-scoped RLS policies as the access model | RLS switched on, default-deny, on every table; access enforced by the data-access guards (ADR-0002) | The app reaches Postgres through Drizzle on a privileged connection, which bypasses RLS. Default-deny still shuts the Supabase client and its anon and authenticated roles out of every business table. |
| A new repo, `as-sales-app`                   | This repo, transferred to `Authority-Solutions/as-sales-app` by the owner                           | Keeps the history and the working screens.                                                                                                                                                              |

The packet's other choices are adopted as written: Drizzle (replacing Prisma), Inngest for durable work, OpenRouter for every model call, the Vantage design system, the screen registry as the source of truth for screens and routes, the registry validator and its Stop hook, the eight repo agents.

## Consequences

- ADR-0002 still stands, with "Prisma" read as "Drizzle". RLS is a seatbelt, never the access check.
- The packet's "isolation probe" (S4) becomes two suites: a data-access suite proving a rep cannot read or change another rep's leads, and a database check that the `anon` and `authenticated` roles read zero rows from every business table.
- Routes follow the registry (`/leads`, `/review-queue`, `/decks/[id]` ...). The `/dashboard/...` routes of the mockups are renamed, not kept beside them.
- The packet's Windows-unaware tooling (`python3`, `./setup`, Bun) needs a Windows path or WSL; recorded in the foundations spec.
