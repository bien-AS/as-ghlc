---
title: Dashboard shell, sample-data seam and placeholders
status: ready
blocked_by: []
owner_to_ask: []
build_now: true
---

# 04. Dashboard shell, sample-data seam and placeholders

**Purpose:** give a signed-in user one frame with navigation to every planned screen, define how the built screens get their sample data so it can be swapped for real data later, and define how unbuilt screens are labelled. It serves every signed-in user, and the developers who will connect real data.

Decisions behind this spec: ADR-0001, ADR-0002, ADR-0003, ADR-0006.

## Problem Statement

After signing in there is nowhere to go. The first screens must be built before any real lead exists, and if they are built against throwaway data in the wrong place, every one of them will be rewritten when real data arrives. Screens that cannot be built yet also need to exist in the navigation, or the team cannot see the whole product or what each missing part is waiting for.

## Solution

Everything after sign-in lives under `/dashboard`, inside one shell.

### The shell

Two fixed parts around a main area: a **sidebar** on the left and a **top navbar**. Both are reusable components (spec 03's rule), not markup inside a page.

**Sidebar (left)**

- The Dealwright wordmark at the top, linking to `/dashboard`. User-facing text in the shell says Dealwright, never ASCRM.
- Navigation to every planned screen, in the order of the table below, each with an icon and a label. The current screen is marked.
- Built screens first, then a divider, then the unbuilt screens. Each unbuilt screen carries a small "Soon" chip beside its label, so a user can tell before selecting it that it is a placeholder. Unbuilt items are still links and are not disabled.
- A control to collapse the sidebar to icons only, and to expand it again. The choice is remembered in that browser. When collapsed, each item shows its label as a tooltip on hover and focus, and the "Soon" chip becomes a dot.

**Top navbar**

- **Page title and breadcrumb.** The current screen's name. On Lead detail: "Pipeline", then the lead's name, with "Pipeline" a link. On Suspect review with a lead open: "Suspect review", then the lead's name.
- **Search entry.** A search field for leads. Submitting it opens the Pipeline with that search applied (spec 05); it has no results of its own. Proposed.
- **Notifications entry.** A bell that links to `/dashboard/notifications`. It shows no unread count in this build, because notifications are a placeholder.
- **Sample data label.** Persistent while the dashboard runs on sample data, with a one-sentence explanation on hover or focus: the leads shown are examples and changes are not kept.
- **Theme switch** (spec 03).
- **User menu.** Shows the signed-in user's name and email, with **Sign out** (spec 02).

**Main area:** where the current screen renders. Its content is limited to the maximum width in spec 03.

### Collapsed and small-screen behaviour

Using the handoff's breakpoints.

| Width            | Sidebar                                                                                                               | Navbar                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1080px and wider | Expanded by default; the user may collapse it to icons.                                                               | Everything shown.                                                                                                                                                        |
| 720px to 1079px  | Collapsed to icons by default; the user may expand it, and it then overlays the main area rather than squeezing it.   | Everything shown; the search field narrows.                                                                                                                              |
| Below 720px      | Hidden. A menu button in the navbar opens it as a sheet over the page; choosing an item or pressing Escape closes it. | Menu button, page title, notifications entry and user menu. Search becomes an icon that opens the field. The theme switch and Sample data label move into the user menu. |

### Keyboard access

- A "Skip to content" link is the first focusable element and moves focus to the main area.
- Tab order is sidebar, then navbar, then main area. Every item is reachable and shows a visible focus ring.
- The sidebar is a labelled navigation landmark; the current item is announced as current.
- The collapse control and the small-screen menu button announce whether the sidebar is expanded.
- The sheet traps focus while open, closes on Escape and returns focus to the menu button.
- The user menu opens with Enter or Space, moves with the arrow keys and closes on Escape.
- A "Soon" item's accessible name includes "not built yet".
- After navigating, focus moves to the new screen's heading.

No user in this build sees a different shell from any other: there are no roles, and every authenticated user gets the full view of everything (owner decision; see Assumptions).

### Navigation

| Nav item                  | Route                         | In this build         | Spec |
| ------------------------- | ----------------------------- | --------------------- | ---- |
| Pipeline                  | `/dashboard`                  | Built, on sample data | 05   |
| Suspect review            | `/dashboard/suspects`         | Built, on sample data | 07   |
| Notifications             | `/dashboard/notifications`    | Placeholder           | 08   |
| Deck presenter            | `/dashboard/deck-presenter`   | Placeholder           | 13   |
| Proposal builder          | `/dashboard/proposal-builder` | Placeholder           | 14   |
| Users and roles           | `/dashboard/users`            | Placeholder           | 12   |
| Settings and integrations | `/dashboard/settings`         | Placeholder           | 16   |

Lead detail (`/dashboard/leads/{leadId}`, spec 06) is built on sample data and is reached from a lead, not from the navigation. While on it, Pipeline stays marked.

Invoices have no screen of their own in the handoff's page list; an invoice appears as a status on a lead. No Invoices nav item is added.

The Suspect review item shows a count of suspects waiting. Neither the Notifications item in the sidebar nor the bell in the navbar shows an unread count in this build, because notifications are a placeholder; the count and its live updates arrive with spec 08.

### Placeholder convention

In the sidebar, an unbuilt screen is listed after the divider with its "Soon" chip, as described above. On the page itself, every unbuilt screen renders the placeholder panel from spec 03 inside the shell, with exactly these parts:

1. The screen's name.
2. A "Not built yet" label.
3. One sentence saying what the screen will do.
4. **Waiting on:** a list naming what the screen is waiting for.

A placeholder has no fake controls, no sample content and no disabled copy of the future interface. The text for each:

| Screen                    | What it will do                                                                        | Waiting on                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Notifications             | List what needs you, newest first, each linking to its lead.                           | Real lead data (the lead store). The screen itself is specified and ready.                                                     |
| Deck presenter            | Present a lead's deck full screen on the call, edit its text and download it as a PDF. | A decision on where the deck service runs and which editor reps use (question 2). The deck templates.                          |
| Proposal builder          | Build a proposal from the lead's details and your prices, review it and send it.       | Access to the proposal service. A decision on how the app learns a proposal was signed (question 6).                           |
| Users and roles           | Show who has access and their role.                                                    | Decisions on what each role sees and on the sign-in rule (question 7), and on how workspaces work (question 9).                |
| Settings and integrations | Connect your CRM and the proposal, invoice and deck services.                          | Decisions on the kind of product (question 9), which tools are fixed (question 10) and which CRMs are supported (question 11). |

Placeholder text follows the rule for all rep-facing text: it names no CRM and no third-party service by brand.

### The sample-data seam

Built screens never touch sample data directly. The path is fixed, and is the same path real data will take:

```text
component -> custom TanStack Query hook -> Route Handler under /api (input parsed with the shared zod schema)
          -> data-access function (current-user guard first) -> fixtures
```

On first paint, the page's Server Component prefetches by calling the same data-access function directly and hands the result to the hook (ADR-0001).

**The replacement rule.** Going live means replacing the bodies of the data-access functions so they query the database instead of the fixtures. Nothing else changes: not the zod schemas, not the Route Handlers, not the query options, not the hooks, not the components. The zod schemas are the contract.

What each layer may and may not do:

| Layer                 | Does                                                                                             | Must not                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Component             | Renders what its hook returns; calls the hook's mutations                                        | Import fixtures, call `fetch`, call a data-access function        |
| Hook                  | Reads and writes through Route Handlers using one query-options factory per resource             | Import fixtures; define a query key a second time                 |
| Server Component page | Prefetches by calling the data-access function directly                                          | Import fixtures; make an HTTP request to our own API              |
| Route Handler         | Parses input with the zod schema, calls the data-access function, returns JSON                   | Import fixtures; contain filtering or business rules              |
| zod schemas           | Define every request and response shape; types are inferred from them                            | Import server-only code or fixtures                               |
| Data-access function  | Runs the current-user guard, then returns data. Async. **The only layer that imports fixtures.** | Return a shape the schema does not describe                       |
| Fixtures              | Static sample records that parse against the schemas                                             | Be imported by anything but data-access functions and their tests |

### The contract

Shaped after the handoff's data model sketch, whose field lists are **assumed**. Provider-specific identifiers in the sketch (the deck service's presentation ID, the proposal service's proposal ID, the invoice service's ID) are not part of the client contract. The workspace is never sent by or to the client; the server resolves it (ADR-0002).

**Lead (list item):** id, name, company, email, stage, exit, status, verdict result, owner (id and name), next booking (kind, time, state) if any.

**Lead (detail):** everything in the list item, plus phone, website, source, budget, form answers (ordered question and answer pairs), created and updated times, and:

- **Verdict:** result (valid, suspect, spam), summary, reasons (list), review outcome (cleared, spam, or none), reviewed by (user name), reviewed at. Absent when the lead is still awaiting a verdict.
- **Bookings:** kind (discovery, proposal review), time, state (confirmed, completed, no-show, cancelled, rescheduled).
- **Deck:** present or absent; when present, template name, view link, PDF link.
- **Proposal:** present or absent; when present, status (draft, sent, viewed, signed, lost).
- **Invoice:** present or absent; when present, status.
- **Activities:** actor (user, system, CRM) with a display name, type, detail, time. Newest first.

**Stage** is one of: New lead, Discovery Call Booked, Qualified, Proposal Review Booked, Proposal Sent, Lead Won. **Exit** is absent or one of: Spam, Nurture, Lead Lost. **Status** is one of the list in spec 05.

**Routes:**

| Route                                    | Purpose                                                                                                                                             | Used by |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `GET /api/leads`                         | A page of list items. Inputs: search text, stage or exit, verdict, owner, a "needs you" category, cursor, limit. Returns items and the next cursor. | 05, 07  |
| `GET /api/pipeline/summary`              | Counts per stage and per exit, the four "needs you" counts, and the list of owners for the filter                                                   | 04, 05  |
| `GET /api/leads/{leadId}`                | One lead in detail                                                                                                                                  | 06, 07  |
| `POST /api/leads/{leadId}/review`        | Record a suspect review. Input: outcome (cleared or spam)                                                                                           | 07      |
| `POST /api/leads/{leadId}/qualification` | Record the decision after the discovery call. Input: decision (qualified or not qualified)                                                          | 06      |
| `POST /api/leads/{leadId}/lost`          | Mark a lead lost. Input: optional reason                                                                                                            | 06      |
| `POST /api/leads/{leadId}/spam`          | Mark a lead spam                                                                                                                                    | 06      |

Every write returns the updated lead in detail. Every route refuses unauthenticated and profile-less callers as defined in spec 02, answers an unknown lead with "not found", and answers invalid input with a validation error naming the fields. A write that the lead's current state does not allow (for example, qualifying a lead that has left the pipeline) is refused with a conflict error and changes nothing.

### Sample data

- About 40 sample leads, enough that every stage, every exit, every verdict, every status in spec 05's list and every "needs you" category has at least two leads, and the list scrolls.
- At least six suspects awaiting review, with realistic form answers and reasons.
- Several sample reps as owners. These are sample names, not User rows.
- Booking times are stored relative to "today" so "calls today" always has entries.
- All names, companies, emails and websites are invented and use reserved example domains. No real person or company appears.
- Sample activities with a CRM actor are labelled "CRM", never with a CRM's name.
- **Writes are kept in server memory only.** A decision made on a sample lead shows immediately and persists while that server instance lives; it is lost on restart and is not shared between server instances. This is a known ceiling of the sample build, not a bug, and the Sample data label says so.

## States

- **Shell loading:** the sidebar and navbar render at once from the server; only the main area shows a skeleton.
- **Sidebar:** expanded, collapsed to icons, or (below 720px) closed or open as a sheet. If the remembered choice cannot be read, the default for the width applies.
- **Signed out or no profile:** the shell never renders; redirects per spec 02.
- **Session expires while in the dashboard:** the next data request is refused as unauthenticated and the user is taken to `/sign-in`, returning to the same page afterwards.
- **Unknown route under `/dashboard`:** a "page not found" panel inside the shell, with a link to the Pipeline.
- **Placeholder:** as defined above. A placeholder has no loading, empty or error state of its own.
- **Suspect count unavailable:** the nav item shows no count rather than a zero or an error.
- **Narrow screens:** as in the table above; below 720px the main area is one column.
- **Long names:** a long user name or lead name in the navbar truncates, with the full text on hover and focus.
- **Empty and error states for built screens** are defined in specs 05, 06 and 07.

## Data

| Entity                                                    | Read                                        | Written                                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| User                                                      | Current user's name and email, for the menu | Nothing                                                                                                                        |
| Lead, Verdict, Booking, Deck, Proposal, Invoice, Activity | From fixtures, through the seam             | Lead (stage, exit, status), Verdict (review outcome, reviewer), Booking (state), Activity (new entries), in server memory only |
| Workspace, Connection, Notification                       | Not read                                    | Not written                                                                                                                    |

No domain model is added to the database in this build. The only database table in use is User.

## Assumptions

- **Questions 7 and 9:** no Workspace, membership or role exists. Every authenticated user sees everything. Owner decision for this build, acceptable only on sample data (ADR-0004).
- **Question 8:** the status values in the contract are the prototype's status lines. Assumed.
- **Question 1:** the stage names are the app's own and are assumed to be the six in the handoff.
- The data model sketch's field lists are assumed; the contract follows them and will move if spec 09 changes them. A contract change is then a deliberate, visible change, not part of "going live".
- Keeping a lead's last stage alongside a separate exit value is proposed (spec 09), not confirmed.
- In-memory writes on sample data are proposed as sufficient for the sample build.

## Acceptance checks

1. A signed-in user with a profile at `/dashboard` sees a left sidebar with all seven nav items and a top navbar with the page title, search, notifications entry, Sample data label, theme switch and a user menu with their name and a working Sign out.
2. The five unbuilt screens appear after a divider, each with a "Soon" chip, and each opens its placeholder.
3. Collapsing the sidebar leaves icons with tooltips; reloading keeps it collapsed.
4. At 900px the sidebar is icons by default; at 700px it is hidden and the menu button opens it as a sheet that closes on Escape and on choosing an item.
5. Typing in the navbar search and pressing Enter opens the Pipeline filtered by that text.
6. Using only the keyboard: Skip to content works, every sidebar and navbar control is reachable with a visible focus ring, and the user menu can be opened, moved through and closed.
7. The shell says "Dealwright" and never "ASCRM".
8. Each of the five placeholder routes shows the screen's name, "Not built yet", the one-sentence description and the "Waiting on" list from the table, and nothing that looks like a working control.
9. No placeholder or shell text contains the name of a CRM or third-party service.
10. **Seam, by inspection:** a search for imports of the fixtures finds them only in data-access functions and their tests.
11. **Seam, by inspection:** no component calls `fetch` or a data-access function; no Route Handler contains more than parse, call, respond.
12. **Seam, by behaviour:** with the browser's network panel open, the Pipeline's client-side refetches go to `/api/leads` and `/api/pipeline/summary`; the first paint shows data without a client request for it.
13. **Contract:** every fixture record parses against the zod schemas (a test fails if one does not).
14. **Guard:** calling any `/api/leads` route signed out is refused as unauthenticated; calling it signed in without a profile is refused as "profile required".
15. **Replacement rehearsal:** changing one data-access function's body to return a different valid lead changes what the screens show with no other file edited.
16. Sending invalid input to a write route returns a validation error and changes nothing; sending a write the lead's state does not allow returns a conflict and changes nothing.
17. An unknown `/dashboard/...` route shows "page not found" inside the shell.
18. The sample data contains no real person, company or domain.
19. **Later, when going live:** the change that connects real data modifies data-access function bodies and removes the fixtures and the Sample data label's condition, and leaves schemas, Route Handlers, query options, hooks and components unchanged.

## User Stories

1. As a signed-in user, I want one frame around every screen, so that I always know where I am.
2. As a rep, I want the Pipeline to be the first thing I see, so that I start with my leads.
3. As a rep, I want navigation to every screen, so that I can move without going back.
4. As a rep, I want the current screen marked in the navigation, so that I do not lose my place.
5. As a rep, I want a count beside Suspect review, so that I know when something needs me.
6. As a user, I want to see my name and sign out from anywhere, so that I can leave safely.
7. As a user, I want the theme switch always available, so that I can change it when the light changes.
8. As a user, I want sample data clearly labelled, so that I never mistake it for real leads.
9. As a user, I want to be told my changes to sample leads are not kept, so that I am not surprised when they reset.
10. As a team member, I want unbuilt screens to exist in the navigation, so that I can see the whole product.
11. As a team member preparing a meeting, I want each unbuilt screen to say what it is waiting on, so that I know what to ask for.
12. As a rep, I do not want placeholder screens to look half-working, so that I do not try to use them.
13. As a rep, I want a clear "page not found" inside the app, so that a bad link does not strand me.
14. As a rep whose session expired, I want to sign in and return to the same page, so that I do not lose context.
15. As a rep on a small screen, I want the navigation to collapse, so that the content has room.
16. As a rep, I want the navigation in a sidebar that I can collapse, so that I choose between labels and space.
17. As a rep, I want my collapsed choice remembered, so that I set it once.
18. As a rep, I want a search field on every screen, so that I can find a lead from wherever I am.
19. As a rep, I want a notifications entry always in view, so that I know where alerts will be.
20. As a rep, I want the page title and a way back shown at the top, so that I know where I am inside a lead.
21. As a rep, I want unbuilt screens marked in the sidebar, so that I know what to expect before I open one.
22. As a keyboard user, I want to skip the navigation and to operate the sidebar, menu and sheet without a mouse, so that the shell does not slow me down.
23. As a screen-reader user, I want the navigation and its current item announced, so that I can orient myself.
24. As a developer, I want the sidebar and navbar as reusable components, so that no page carries its own copy.
25. As a developer, I want screens to read sample data through the real path, so that going live does not mean rewriting them.
26. As a developer, I want one rule for what "going live" touches, so that I can verify the swap in review.
27. As a developer, I want the zod schemas to be the contract, so that screens and server agree on shapes.
28. As a developer, I want fixtures checked against the schemas, so that sample data cannot drift.
29. As a developer, I want loading, error and unauthenticated paths exercised now, so that they are not discovered at launch.
30. As a developer, I want the guard in the data-access function from the start, so that no route ships open.
31. As a developer, I want writes on sample data to behave like real writes from the screen's point of view, so that mutation and invalidation code is real.
32. As the project lead, I want every authenticated user to see everything for now, so that we can show the product before roles are decided.
33. As the project lead, I want no real person's details in sample data, so that demos are safe.

## Implementation Decisions

- **Dependencies.** `@tanstack/react-query` and `zod` are not installed and must be added at build time. A query client provider wraps the dashboard.
- **Shell.** A layout for everything under `/dashboard`, rendered on the server. It resolves the current user with spec 02's resolver before rendering anything and applies spec 02's redirects.
- **Sidebar and navbar are two reusable components** (spec 03's rule), built on the component library's sidebar, sheet, dropdown menu and tooltip primitives and themed with the tokens. The layout composes them; no page contains shell markup.
- **One navigation table** (label, route, icon, built or not) drives the sidebar, the page titles and the placeholder routes, so they cannot disagree.
- **Sidebar state** (expanded or collapsed) is remembered per browser and applied before first paint so it does not jump.
- **Navbar search** only navigates to the Pipeline with the search in the address; all searching is spec 05's.
- **Breadcrumb** on Lead detail reads the lead's name from the lead-detail query already on the page; it makes no request of its own.
- **No realtime channel** is opened by the shell in this build (spec 08 adds it with the unread count).
- **Resources.** Two query resources, each with one query-options factory shared by the server prefetch and the hook: leads (list and detail) and pipeline summary. Mutations invalidate the lead detail, the lead list and the summary.
- **Hydration.** Prefetched queries use a non-zero stale time so the client does not refetch immediately (ADR-0001).
- **Data-access module for leads.** A small set of async functions matching the routes: list leads, get lead, get pipeline summary, review suspect, set qualification, mark lost, mark spam. Each begins with the current-user guard. Filtering, search, paging, counts and the rules for which write is allowed in which state live here, so they are replaced together when the bodies change.
- **Paging.** The list uses an opaque cursor and a limit from the start, even though fixtures are small, so the contract already suits high volume.
- **Search** matches name, company and email, case-insensitively.
- **Sample store.** The fixtures are loaded once into server memory and writes change that copy. This is a deliberate simplification with a known ceiling: not durable and not shared across instances. It disappears when the function bodies are replaced.
- **Errors.** One response shape for errors across all routes: a machine-readable code and a human-readable message, with field details for validation errors. Codes cover unauthenticated, profile required, not found, invalid input and conflict.
- **Placeholders** are one shared page component fed by a small table of name, description and "waiting on" entries, so the five placeholder routes cannot diverge.
- **Sample data label** is driven by one flag owned by the data-access layer, so going live removes it in the same place the bodies change.
- **No ownership check.** The guard checks authentication and profile only. See Further Notes.
- **Server Actions are not used** (ADR-0003).

## Testing Decisions

_Seams confirmed by the owner: data-access functions and Route Handlers through their public behaviour with Vitest; pages through Testing Library at page level; no end-to-end browser suite yet._

- A good test states what goes in and what comes out at a public boundary. Tests written this way against the data-access functions and Route Handlers must still pass, unchanged, after the bodies are replaced with database queries; that is the test of the seam.
- **Data-access functions**, with Vitest: the guard refuses signed-out and profile-less callers before any data is returned; each filter, the search, the cursor and the counts; each write's allowed and refused states; a write appears in a later read.
- **Route Handlers**, with Vitest, through HTTP behaviour: status and error code for each refusal, validation errors for bad input, the response parses against the schema.
- **Fixtures:** one test parses every fixture against the schemas and checks coverage (every stage, exit, verdict, status and "needs you" category is represented).
- **Shell and placeholders**, with Testing Library at page level: sidebar items and routes, the current item, the "Soon" marking, collapse and expand, the sheet at small width, the navbar's title, search navigation and user menu, each placeholder's four parts.
- No end-to-end browser suite yet. The seam checks done by inspection or rehearsal (fixture imports, thin handlers, network panel, replacement rehearsal) are carried out in review.
- Prior art: none in the repo.

## Out of Scope

- Any Prisma model other than User; any database read or write of lead data.
- Roles, per-role navigation, Workspace switching.
- Real notifications and an unread count (spec 08).
- Deck presenter and proposal builder interfaces, even as sketches beyond the placeholder.
- Search results in the navbar itself, a command palette or keyboard shortcuts.
- Persisting sample-data changes.
- Calls to any external service.

## Further Notes

- **Conflict with ADR-0002 and AGENTS.md, recorded not resolved.** Both require the guard to check authentication and then ownership through tenant membership. By owner decision there is no Workspace or membership yet, so the guard here checks authentication and profile only. When real data and spec 12 arrive, the ownership check is added inside these same data-access functions, which is part of replacing their bodies.
- **Naming.** ADR-0002 says "tenant". The canonical term is Workspace; the ADR stays as written.
- **Difference from the handoff.** The handoff asked for the deck presenter and proposal builder to be "sketched as shells". The owner's decision makes them labelled placeholders in this build.
- The contract deliberately leaves out fields the screens do not show. Adding a field later is a contract change reviewed on its own.
