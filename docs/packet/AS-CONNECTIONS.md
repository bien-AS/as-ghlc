# AS-CONNECTIONS: deploy targets and account rows

Deploy targets are locked rows. **A new target gets a new row here before its first write.** Keys live in Vercel env + `.env.local` (single-quoted), never in code.

| Target | Row | Trap |
|---|---|---|
| GitHub | org `Authority-Solutions`, repo `as-sales-app`, private, created by new-app.sh at S2 (Bien) | The org's GitHub identity is `raysmithas`; GitHub and Supabase accounts deliberately do NOT match |
| Supabase | project ref: **`cltupvpukgrklcycaimg`** (chosen by the owner on 2026-10-20 as the database for migrations and the isolation suites; its org id was NOT verified from the build session, which has no Supabase management access: confirm it before any deploy), meant to sit under the org owned by **john.smith@authoritysolutions.com** (org id `yjfcrhncmqvyqtwinjyx`) ONLY | `ray.smith@authoritysolutions.com` owns a DECOY org also named "Authority Solutions" (also Pro). Verify by org ID or listed projects, never by name. Before any deploy: `supabase projects list \| grep <ref>` (the CLI lists projects from the wrong account and then 403s on deploy) |
| Vercel | team/scope: **FILL-AT-S2** (the AS team; `vercel link --scope <team>` explicit) | Commit email must match the Vercel account email or deploys are silently blocked |
| GoHighLevel | custom connector app on Lee's build; dev location first, production location at S17; webhook secrets per location | Stage writes trigger Lee's workflows: prove idempotency on the dev location before production (no duplicate client emails) |
| Presenton | self-hosted alongside the app (service URL per env); templates in-repo under `templates/` | Template changes ship as repo PRs, never hot-edited in the service |
| Smart Pricing Table | API key owner: Mitchell's account (the MCP-connected org); signature webhook secret per env | Credentials to be obtained by Zachery before S12 |
| Invoice Ninja | API token + webhook secret per env; key owner recorded at S13 | Amounts always read from synced IN state, never recomputed |
| Fathom | API access under the company account; read-only | Matching below confidence threshold renders unmatched, never guesses |
| OpenRouter | company key; per-pipeline model config in `app_settings` | Every run logged with cost; null cost while pending, never 0 |

Supabase org verification note: the decoy-org trap is the standing data-safety rule for this org. The emitted `.mcp.json` pins the Supabase MCP to this app's `--project-ref` once S2 creates the project; that pin is the seatbelt.
