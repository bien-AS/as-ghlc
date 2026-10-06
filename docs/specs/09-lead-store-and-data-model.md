---
title: Lead store and data model
status: needs-clarification
blocked_by:
  - question 7
  - question 9
owner_to_ask:
  - Zach
  - Mitchell
build_now: false
---

# 09. Lead store and data model

**Purpose:** define the record ASCRM keeps for every lead and everything attached to it, so the app, not the CRM, holds the truth. It serves every other part of the product, and the developers who replace sample data with real data.

> **Needs clarification: questions 7 and 9.**
>
> - **Question 9:** what kind of product is it, one shared app with a Workspace per customer or a deployment per customer? **Assumed: one shared app, a Workspace per customer.** Who answers: Zach, Mitchell.
> - **Question 7:** what does each role see, and what is the sign-in rule? **Assumed: the roles and rule proposed in spec 12.** Who answers: Zach.
>
> This spec is written to those assumed answers. Every entity is new, and **every field list is assumed**: the handoff calls its sketch "a starting point for the spec, not a schema". Nothing here is built in the current build, which uses fixtures (spec 04).

## Problem Statement

ASCRM began as a layer over one CRM, with the CRM holding the lead. As a product it must hold the lead itself, so that any CRM can connect, a lead imported twice is still one lead, and each customer's data is kept apart from every other's. Today the only table is User. Verdicts, bookings, decks, proposals, invoices, the timeline and notifications have nowhere to live.

## Solution

Eleven entities in the app's own database (Supabase Postgres, through Prisma). The lead is the centre; everything else hangs off a lead or a Workspace.

| Entity       | Holds                              | Key fields (assumed)                                                                                                         |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Workspace    | One customer of the product        | name, allowed email domains, branding                                                                                        |
| User         | A person who signs in              | workspace, email, role (owner, admin, staff), external CRM user ID; plus firstName and lastName, which exist today           |
| Connection   | A Workspace's link to one service  | type (crm, proposals, invoices, decks), provider, credentials reference, sync status                                         |
| Lead         | The record of one prospect         | workspace, source, external ID, name, company, email, phone, website, budget, form answers, owner, stage, status, timestamps |
| Verdict      | The AI's judgment of a lead        | lead, result (valid, suspect, spam), summary, reasons, reviewed by, review outcome                                           |
| Booking      | A scheduled call                   | lead, kind (discovery, proposal review), time, state (confirmed, completed, no-show, cancelled, rescheduled)                 |
| Deck         | A generated presentation           | lead, template, the deck service's presentation ID, view link, PDF link                                                      |
| Proposal     | A proposal in the proposal service | lead, the proposal service's proposal ID, status (draft, sent, viewed, signed, lost), line items snapshot                    |
| Invoice      | A draft in the invoice service     | lead, proposal, the invoice service's ID, status                                                                             |
| Activity     | One entry in a lead's timeline     | lead, actor (user, system, CRM), type, detail, time                                                                          |
| Notification | An alert for a user                | user, lead, type, read state                                                                                                 |

### Rules the store must keep

1. **A lead imported twice does not duplicate.** Source plus external ID identifies a lead within a Workspace and is unique there. This is what makes import from more than one CRM possible.
2. **Every row belongs to a Workspace**, directly or through its lead, and no query returns a row from another Workspace.
3. **Stage and status are both kept.** Stage is one of the six in the pipeline. Status is a finer value inside the stage; its list is open (question 8).
4. **Exits.** A lead that leaves the pipeline records which exit it took (Spam, Nurture, Lead Lost) and keeps the stage it left from. _Proposed; the sketch does not say how an exit is stored._
5. **No CRM-specific names** appear in the model: no CRM's field names, stage names or identifiers other than the opaque external ID and the provider name on a Connection.
6. **Service credentials** are stored per Workspace, referenced from a Connection, and never reach the browser.
7. **User.id is the Supabase auth user id** (ADR-0005).
8. **The timeline is append-only.** Activities are added, never edited or removed.
9. **A verdict keeps the AI's result** when a rep reviews it; the review outcome is stored beside it.

### Relationship to the current build

The zod schemas in spec 04 are the client contract, shaped after this model. When this spec is built, the data-access function bodies are replaced with queries against these tables (ADR-0006) and the ownership guard is added to them.

## States

A data model has no screens. The states that matter are the record's:

- **Empty:** a new Workspace has no leads, connections or users beyond its creator. Every query must return an empty result, not an error.
- **Loading:** not applicable.
- **Error:** a write that breaks a rule above (duplicate source and external ID, a row pointing at another Workspace's lead, an unknown stage) is rejected by the database itself, not only by application code.
- **Partial lead:** a lead may arrive with only some fields. Name and source are required; everything else may be absent.
- **Lead without a verdict:** valid state, meaning "awaiting verdict".
- **Removed in the CRM:** what happens to the lead here is part of question 1 (spec 11).

## Data

This spec defines the entities; it reads and writes all of them. Which block writes which:

| Entity          | Written by                                                       |
| --------------- | ---------------------------------------------------------------- |
| Workspace, User | Sign-in, profile setup, users and roles (specs 02, 12)           |
| Connection      | Settings and integrations (spec 16)                              |
| Lead, Booking   | CRM adapter (import, events), Pipeline (stage, status, exit)     |
| Verdict         | Validation (result), Suspect review (review outcome)             |
| Deck            | Decks (spec 13)                                                  |
| Proposal        | Proposals (spec 14)                                              |
| Invoice         | Invoices (spec 15)                                               |
| Activity        | Every block, when it changes a lead                              |
| Notification    | Validation, Proposals, Invoices (created); its user (read state) |

## Assumptions

- **Question 9:** shared app, Workspace per customer. If the answer is a deployment per customer, Workspace collapses to a single settings record and rule 2 is enforced by deployment rather than by query.
- **Question 7:** User carries a role of owner, admin or staff, and a lead's owner is a User. What each role may read is in spec 12.
- **Question 8:** the status list is open; the store holds status as a value from a list that can change without restructuring.
- **Question 1:** the app owns the stage. Whether CRM-side changes write back into these rows is not decided.
- **Question 10:** deck, proposal and invoice tools are fixed in the first version, so Deck, Proposal and Invoice each hold one service's identifier rather than a source and external ID pair.
- **Question 3:** an Invoice is a draft; its status values are not listed in the sketch.
- A User belongs to exactly one Workspace. Assumed from the sketch's "workspace" field; membership of several is part of question 9.
- Whether Verdict keeps history (one row per validation run) or only the latest is not stated; assumed one current verdict per lead.
- Whether the app ever assigns leads itself is to be scoped. For the first customer the CRM assigns the owner and the app stores what it is given.

## Acceptance checks

To run when this spec is built.

1. Importing the same lead twice (same Workspace, source and external ID) leaves one lead.
2. The same source and external ID in two Workspaces are two leads.
3. Signed in as a user of Workspace A, no data-access function returns a lead, verdict, booking, deck, proposal, invoice, activity, notification, connection or user of Workspace B, including by guessing an id.
4. Every data-access function resolves the caller before querying; a review finds none that takes an id without doing so.
5. A lead holds a stage and a status at the same time; an exited lead holds its exit and its last stage.
6. No table or column name contains a CRM's name.
7. No API response contains a service credential.
8. After the swap, the tests written against the data-access functions and Route Handlers in specs 04 to 07 pass unchanged, and the change touched only data-access function bodies, the schema and migrations, and the removal of fixtures.
9. A User's id equals its Supabase auth user id.
10. Activities cannot be updated or deleted through any data-access function.

## User Stories

1. As a rep, I want my leads kept in the app, so that I never open the CRM.
2. As a customer, I want my Workspace's leads invisible to every other customer, so that my data is safe.
3. As a customer connecting a CRM, I want a re-import not to duplicate leads, so that my pipeline stays clean.
4. As a customer with two CRMs, I want leads from each kept distinct, so that identifiers do not collide.
5. As a rep, I want a lead's verdict stored with its reasons, so that I can read why.
6. As a rep, I want the record to show who reviewed a suspect, so that decisions are accountable.
7. As a rep, I want a lead's calls stored with their state, so that I see no-shows and reschedules.
8. As a rep, I want a lead's deck, proposal and invoice linked from the lead, so that I find them in one place.
9. As a rep, I want every change to a lead recorded in its timeline, so that I can see its history.
10. As a rep, I want the timeline to be permanent, so that history cannot be rewritten.
11. As a rep, I want notifications stored per user, so that mine are mine.
12. As an admin, I want leads to carry an owner, so that I can filter by rep.
13. As a customer, I want my service keys kept on the server, so that they cannot leak from a browser.
14. As a developer, I want source and external ID on every lead, so that any CRM can be supported.
15. As a developer, I want no CRM names in the model, so that a second adapter needs no schema change.
16. As a developer, I want the model to match the contract the screens already use, so that going live changes only data-access function bodies.
17. As a developer, I want the database to reject rows that break the rules, so that a bug in one function cannot corrupt the store.
18. As the project lead, I want every assumed field marked, so that the team can correct the model before it is built.

## Implementation Decisions

- **Database and access path.** Supabase Postgres, reached only through Prisma (ADR-0002). Migrations are owned by Prisma. Supabase's own `auth` schema is not modelled or migrated.
- **Authorization lives in data-access functions, not in row-level security** (ADR-0002). The guards are: authenticated user with a profile, then membership of the Workspace that owns the resource. See Further Notes for the conflict with the handoff on this point.
- **Workspace scoping.** Lead, Connection and User carry the Workspace directly. Verdict, Booking, Deck, Proposal, Invoice, Activity and Notification reach it through their lead (Notification also through its user). Every query filters by the caller's Workspace, resolved on the server and never taken from the client.
- **Constraints enforced by the database:** uniqueness of (workspace, source, external ID) on Lead; uniqueness of email on User; required relations; enumerated values for stage, exit, verdict result, review outcome, booking kind and state, proposal status, activity actor, connection type and user role.
- **Status** is stored as a value validated by the application against the current list, not as a database enumeration, so the answer to question 8 needs no migration.
- **Exit** is a separate optional value on Lead; stage keeps its last value. Proposed.
- **Form answers** are stored as an ordered list of question and answer pairs on the Lead, since forms differ per customer.
- **Reasons** on a Verdict are an ordered list of short texts.
- **Line items snapshot** on a Proposal is a stored copy taken when the proposal is sent, so later price changes do not alter history.
- **Credentials.** A Connection holds a reference to a credential kept in a secrets store, not the credential itself. Which store is part of spec 16.
- **User.id** has no generated default; it is supplied from the session (ADR-0005). The existing User model gains workspace, role and external CRM user ID under spec 12.
- **Timestamps.** Every entity records when it was created; Lead also records when it was last updated and when it last had activity, which the nurture rule needs.
- **Identifiers** of other entities are generated by the app. External identifiers are stored as opaque text.
- **The swap** from fixtures follows ADR-0006.

## Testing Decisions

_Seams confirmed by the owner._

- A good test goes through a data-access function and checks what a caller in a given Workspace can and cannot see or change. It does not query tables directly or assert on SQL.
- **Data-access functions**, with Vitest, against a real test database: Workspace isolation for every entity; the duplicate-import rule; the append-only timeline; each guard's refusals.
- **Route Handlers**, with Vitest: unchanged from specs 04 to 07, which is the point of the seam.
- The suites written for the sample build are prior art and must pass against the real store without edits.
- No end-to-end browser suite yet.

## Out of Scope

- Any of this in the current build, which uses fixtures and adds no model beyond User.
- The CRM adapter and import (spec 11); validation (spec 10); decks, proposals and invoices (specs 13 to 15).
- Roles, invites and the users screen (spec 12); the settings screen and credential storage (spec 16).
- Self-serve creation of a Workspace.
- Per-Workspace branding in the interface.
- Reporting, analytics, audit beyond the timeline, data export, retention and deletion rules.
- The app assigning leads to reps itself.

## Further Notes

- **Conflict between the handoff and ADR-0002, recorded not resolved.** The handoff says Workspace access rules are enforced "in the database, not only in the UI". ADR-0002 says the app's database connection bypasses row-level security, so access rules are application code in the data-access layer. This spec follows the accepted ADR. The handoff's intent (not relying on the interface to hide data) is met, but enforcement is in the server's data-access layer rather than in database policies. If database-level enforcement is a firm requirement, ADR-0002 has to be reopened.
- **Naming.** ADR-0002 says "tenant"; the canonical term is Workspace.
- The handoff labels the lead store "Ready" in its architecture table and places this spec fifth in its work order "with questions 7 and 9 marked". It is carried here as needs-clarification because Workspace and role fields cannot be fixed until those questions are answered.
- The lead fields come from the prototype's sample data.
