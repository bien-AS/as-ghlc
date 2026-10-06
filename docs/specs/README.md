# ASCRM specs

One spec per file. These are files only; there are no GitHub issues for them.

**ASCRM is the internal name of Dealwright.** The public name is Dealwright, shown as "Dealwright by Authority Solutions" while the product is early. Specs say ASCRM in internal prose and Dealwright wherever they describe text a user sees.

Sources: the owner's "ASCRM app: spec handoff" and its companion "ASCRM app: architecture review" (both 7 October 2026), plus owner decisions made afterwards, which are recorded in `docs/adr/0004` to `0006` and in the specs themselves. Terms are defined in `GLOSSARY.md` at the repo root.

## Blocked and waiting, at a glance

For whoever is preparing the next team meeting. Nothing in this table can be finished without the named person.

| Spec                              | Status              | Waiting on                                                                                                     | From                         |
| --------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 10 Validation                     | blocked             | Lean's export of past form responses; questions 4 and 5                                                        | Lean, Mitchell               |
| 13 Decks and deck presenter       | blocked             | Question 2 (where Presenton runs, whose editor, calendar on the last slide); the Presenton templates           | Zach                         |
| 14 Proposals and proposal builder | blocked             | Question 6; SmartPricingTable API access from Mitchell's account; the Authority Solutions proposal template ID | Zach, Mitchell               |
| 15 Invoices                       | blocked             | Question 3; Invoice Ninja API access; the mapping of proposal fields to invoice lines                          | Mitchell, through Zach       |
| 16 Settings and integrations      | to-be-scoped        | Questions 9, 10 and 11                                                                                         | Zach, Mitchell, Project lead |
| 07 Suspect review                 | needs-clarification | Question 4. Being built now on the assumed answer.                                                             | Lean, Mitchell               |
| 09 Lead store and data model      | needs-clarification | Questions 7 and 9                                                                                              | Zach, Mitchell               |
| 11 CRM adapter contract and GHL   | needs-clarification | Questions 1, 5 and 11. The contract is proposed and unreviewed.                                                | Zach, Lean, Project lead     |
| 12 Users, roles, workspace access | needs-clarification | Questions 7 and 9                                                                                              | Zach, Mitchell               |

Also to raise at the next meeting, because it changes other people's work: **the product direction itself** (questions 9 to 11). It was set by the project lead on 7 October and has not been discussed with Zach or Mitchell. Zach's 5 October plan has Lean building on GHL as the backend; the adapter approach keeps that work, but nobody outside the handoff has agreed to it.

**Before real leads are connected:** spec 12 must be built. Sign-up is open (ADR-0004) and every signed-in user currently sees everything, which is safe only on sample data.

## Status legend

| Status              | Meaning                                                     | What the spec contains                                                                           |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| ready               | Decided, with enough detail                                 | The full spec                                                                                    |
| needs-clarification | A decision between known options is missing                 | The full spec, written to the assumed option, with the assumption marked and the question listed |
| blocked             | Depends on a person, an access key or a file we do not have | The interface only, and exactly what is missing and from whom                                    |
| to-be-scoped        | Agreed in direction only                                    | A one-paragraph placeholder                                                                      |

An assumption is never a requirement. Where a spec says "assumed" or "proposed", it is waiting for someone to confirm it.

## Index

`blocked_by` is copied from each file's frontmatter. "Build now" means the spec is part of the current build: landing page, authentication and the dashboard on sample data.

| File                                         | Title                                              | Status              | Blocked by                                                                                                     | Build now | What unblocks it, or what to watch                                                                                                                                    |
| -------------------------------------------- | -------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-landing-page.md`                         | Landing page                                       | ready               | None                                                                                                           | Yes       | Not blocked. Open notes: "Planned" labelling, a logo for dark surfaces, a Dealwright logo, legal pages. Tokens flagged for question 12.                               |
| `02-authentication-and-profile-setup.md`     | Authentication and profile setup                   | ready               | None                                                                                                           | Yes       | Not blocked. Needs a custom SMTP provider before real users (not chosen), and several Supabase behaviours verified by hand.                                           |
| `03-ui-foundations.md`                       | UI foundations                                     | ready               | None                                                                                                           | Yes       | Not blocked. Flagged for question 12 (Zach): palette is assumed. Component library awaits owner confirmation.                                                         |
| `04-dashboard-shell.md`                      | Dashboard shell, sample-data seam and placeholders | ready               | None                                                                                                           | Yes       | Not blocked.                                                                                                                                                          |
| `05-pipeline-page.md`                        | Pipeline page                                      | ready               | None                                                                                                           | Yes       | Not blocked. Status list flagged for question 8 (Lean).                                                                                                               |
| `06-lead-detail-page.md`                     | Lead detail page                                   | ready               | None                                                                                                           | Yes       | Not blocked. Carries assumptions from questions 1, 3, 4, 5, 7 and 8.                                                                                                  |
| `07-suspect-review.md`                       | Suspect review                                     | needs-clarification | question 4                                                                                                     | Yes       | Lean and Mitchell answer question 4. Built now on the assumed answer (booking kept until review).                                                                     |
| `08-notifications.md`                        | Notifications                                      | ready               | None                                                                                                           | No        | Not blocked; a placeholder in this build. Built once the lead store (09) and a block that raises notifications exist. Transport decided: Supabase Realtime Broadcast. |
| `09-lead-store-and-data-model.md`            | Lead store and data model                          | needs-clarification | question 7; question 9                                                                                         | No        | Zach and Mitchell answer questions 7 and 9.                                                                                                                           |
| `10-validation.md`                           | Validation                                         | blocked             | Lean's export of past form responses; question 4; question 5                                                   | No        | Lean sends the export; Lean and Mitchell answer questions 4 and 5.                                                                                                    |
| `11-crm-adapter-contract-and-ghl-adapter.md` | CRM adapter contract and the GHL adapter           | needs-clarification | question 1; question 5; question 11                                                                            | No        | Zach and Lean review the proposed contract and answer questions 1 and 5; Project lead and Zach answer question 11.                                                    |
| `12-users-roles-and-workspace-access.md`     | Users, roles and workspace access                  | needs-clarification | question 7; question 9                                                                                         | No        | Zach answers question 7; Zach and Mitchell answer question 9. Holds the deferred domain-or-invite sign-in rule.                                                       |
| `13-decks-and-deck-presenter.md`             | Decks and the deck presenter                       | blocked             | question 2; Presenton templates from Zach                                                                      | No        | Zach answers question 2 and supplies the templates.                                                                                                                   |
| `14-proposals-and-proposal-builder.md`       | Proposals and the proposal builder                 | blocked             | question 6; SmartPricingTable API access from Mitchell's account; the Authority Solutions proposal template ID | No        | Mitchell grants API access; Zach and Mitchell answer question 6 and supply the template ID.                                                                           |
| `15-invoices.md`                             | Invoices                                           | blocked             | question 3; Invoice Ninja API access; the mapping of proposal fields to invoice lines                          | No        | Mitchell, through Zach, answers question 3, grants access and gives the field mapping.                                                                                |
| `16-settings-and-integrations.md`            | Settings and integrations                          | to-be-scoped        | question 9; question 10; question 11                                                                           | No        | Zach, Mitchell and the Project lead answer questions 9, 10 and 11.                                                                                                    |

## Open questions

Numbers match the handoff and the markers in the architecture review. "Assumed for now" is what the specs are written to; it is not a decision.

| #   | Question                                                                                                                            | Assumed for now                                                                                                               | Who answers            | Label               | Specs it holds up                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | How do the app and the CRM stay in step? Which CRM-side changes flow back, who wins a conflict, how stages map.                     | The app owns the stage and pushes it out                                                                                      | Zach, Lean             | Needs clarification | 11 (holds it). Assumption carried in 05, 06, 09.                                                          |
| 2   | Where does Presenton run, and whose editor do reps use? Does a GHL calendar embed on the last slide?                                | None                                                                                                                          | Zach                   | Blocked             | 13 (blocks it). Deck presenter placeholder in 04. Indirectly 07.                                          |
| 3   | How far does invoicing go: draft only, or send and manage in the app?                                                               | Draft only                                                                                                                    | Mitchell, through Zach | Blocked             | 15 (blocks it). Assumption carried in 01, 05, 06, 08, 09.                                                 |
| 4   | Is a suspect lead's booking cancelled at once or kept until a rep reviews it?                                                       | Kept until review                                                                                                             | Lean, Mitchell         | Needs clarification | 07 (holds it), 10 (blocks it). Assumption carried in 01, 06, 08, 11.                                      |
| 5   | Does the app cancel spam bookings itself, or write the verdict and let a CRM workflow react?                                        | The app does it through the adapter                                                                                           | Lean                   | Needs clarification | 10 (blocks it), 11 (holds it). Assumption carried in 05, 06, 07.                                          |
| 6   | How does the app learn a proposal was signed, and when do we get SPT API access?                                                    | Poll proposal status and events                                                                                               | Zach, Mitchell         | Blocked             | 14 (blocks it). Proposal builder placeholder in 04. Assumption carried in 08.                             |
| 7   | What does each role see, and what is the sign-in rule?                                                                              | As in the handoff's "Roles and access" (now in spec 12). For the current build the owner has decided: open sign-up, no roles. | Zach                   | Needs clarification | 09, 12 (holds them). Assumption carried in 02, 04, 05, 06, 07, 08, 11. Users and roles placeholder in 04. |
| 8   | Which statuses does a lead have inside each stage?                                                                                  | The prototype's status lines                                                                                                  | Lean                   | Needs clarification | 05 (flagged: status line and filters). Assumption carried in 04, 06, 07, 09, 11.                          |
| 9   | What kind of product is it: one shared app with a workspace per customer, or a deployment per customer? Who is the second customer? | Shared app, workspace per customer                                                                                            | Zach, Mitchell         | To be scoped        | 09, 12 (holds them), 16 (unscoped). Assumption carried in 01, 02, 04, 11.                                 |
| 10  | Are the proposal, invoice and deck tools fixed, or adapters too?                                                                    | Fixed in the first version                                                                                                    | Zach                   | To be scoped        | 16 (unscoped). Assumption carried in 09, and behind 13, 14, 15.                                           |
| 11  | Which CRM adapters, in what order? Does n8n have a role? What does a CRM without sequences or calendars need?                       | GHL first, Zoho next, no n8n                                                                                                  | Project lead, Zach     | To be scoped        | 11 (holds it), 16 (unscoped). Assumption carried in 01.                                                   |
| 12  | Which design system: the prototype's palette or ASVantage?                                                                          | The prototype's palette                                                                                                       | Zach                   | Needs clarification | 03 (flagged), and through it all UI work: 01, 02, 04, 05, 06, 07.                                         |

### Waiting on, from the 5 October action items

- **Zach:** the build plan and prototype files, the Presenton templates, and Mitchell's answers on Invoice Ninja scope and SPT API access.
- **Lean:** an export of past GHL form responses for the spam rules, and links to the existing artifacts for Zach.

### Open points that are not numbered questions

Raised by owner decisions made after the handoff. Each is recorded in the spec named.

| Point                                                                                      | Where  | Who            |
| ------------------------------------------------------------------------------------------ | ------ | -------------- |
| A custom SMTP provider is needed before real users can sign up; none is chosen             | 02     | Project lead   |
| Supabase behaviours marked "unverified" must be checked by hand against the real project   | 02     | Whoever builds |
| A light version of the Authority Solutions logo for dark surfaces does not exist           | 01, 03 | Project lead   |
| No Dealwright logo exists; a text wordmark is assumed                                      | 01, 03 | Project lead   |
| Privacy policy and terms do not exist, though sign-up is open                              | 01, 02 | Project lead   |
| shadcn/ui as the component library is recommended by the lead, awaiting owner confirmation | 03     | Project lead   |
| Whether a server key on the realtime REST broadcast endpoint bypasses the channel policy   | 08     | Whoever builds |

## Decisions that shape these specs

| ADR  | Decision                                                                                   |
| ---- | ------------------------------------------------------------------------------------------ |
| 0001 | TanStack Query owns server state; Server Components only prefetch into it                  |
| 0002 | Supabase Auth for identity; authorization in the data-access layer, not RLS                |
| 0003 | Route Handlers are the only client-to-server transport; zod schemas are the contract       |
| 0004 | Sign-up is open to anyone for now                                                          |
| 0005 | The app User row is created at profile setup and shares its id with the Supabase auth user |
| 0006 | Sample data sits behind the real data path                                                 |

## The handoff's work order, mapped

The handoff listed twelve specs. The owner's later decisions added the landing page, moved sign-in forward and split out the dashboard shell and notifications.

| Handoff order | Handoff spec                                          | File here                                               |
| ------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| 1             | UI foundations                                        | 03                                                      |
| 2             | Pipeline page                                         | 05                                                      |
| 3             | Lead detail page                                      | 06                                                      |
| 4             | Suspect review                                        | 07                                                      |
| 5             | Lead store and data model                             | 09                                                      |
| 6             | Validation                                            | 10                                                      |
| 7             | CRM adapter contract and the GHL adapter              | 11                                                      |
| 8             | Sign-in, users and roles                              | 02 (sign-in, ready by owner decision) and 12 (the rest) |
| 9             | Decks and the deck presenter                          | 13                                                      |
| 10            | Proposals and the proposal builder                    | 14                                                      |
| 11            | Invoices                                              | 15                                                      |
| 12            | Settings and integrations, further adapters           | 16                                                      |
| Not listed    | Landing page; dashboard shell and seam; notifications | 01, 04, 08                                              |
