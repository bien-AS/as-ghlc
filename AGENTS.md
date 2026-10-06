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
- **Database:** Prisma 7.
- **Components:** always look for opportunities to extract reusable components (sidebars, navbars, and the like) into `src/components/ui` rather than leaving them inline in a page.

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
