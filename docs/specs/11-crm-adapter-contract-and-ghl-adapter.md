---
title: CRM adapter contract and the GHL adapter
status: needs-clarification
blocked_by:
  - question 1
  - question 5
  - question 11
owner_to_ask:
  - Zach
  - Lean
  - Project lead
build_now: false
---

# 11. CRM adapter contract and the GHL adapter

**Purpose:** connect a customer's CRM to ASCRM through one contract, so the rest of the app never knows which CRM is behind it; and build the first adapter, for GoHighLevel (GHL), for Authority Solutions. It serves customers connecting a CRM, and the developers of every other block.

This is the only spec that may name a CRM, a CRM field or a CRM stage.

> **Needs clarification: questions 1, 5 and 11.** The contract below is **proposed** and has not been reviewed by Zach or Lean.
>
> - **Question 1:** how do the app and the CRM stay in step? Which CRM-side changes flow back, who wins a conflict, how stages map. **Assumed: the app owns the stage and pushes it out.** Who answers: Zach, Lean.
> - **Question 5:** does the app cancel spam bookings itself, or write the verdict and let a CRM workflow react? **Assumed: the app does it through the adapter.** Who answers: Lean.
> - **Question 11:** which CRM adapters, in what order; does n8n have a role; what does a CRM without sequences or calendars need? **Assumed: GHL first, Zoho next, no n8n.** How far capability handling goes is to be scoped. Who answers: Project lead, Zach.
>
> The handoff's work order places this spec "after the next meeting". Nothing here is built in the current build.

## Problem Statement

ASCRM began as a tool over one CRM. As a product, it must work with whichever CRM a customer already has. If knowledge of one CRM's fields, stages and webhooks spreads through the app, every new CRM means changing every block. Today nothing is connected at all: Lean has not yet connected anything to the app, and the connection itself is unbuilt.

## Solution

One contract that every adapter meets, and one adapter per CRM behind it. Every other block talks to "the connected CRM" through the contract and never to a CRM directly.

### The five jobs (proposed)

| Job         | What the adapter must do                                                                                    | GHL today                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Connect     | Store credentials for one Workspace and report whether the connection is healthy                            | To be built. Credential type not yet chosen.                                                  |
| Import      | Pull existing leads into the lead store, with source and external ID, without duplicates                    | To be built                                                                                   |
| Events in   | Turn CRM events into app events: lead created, booking made, no-show, cancelled, rescheduled, stage changed | GHL can send webhooks. Workflows are built on Lean's side.                                    |
| Updates out | Apply app changes to the CRM: verdict, deck link, stage, booking cancellation, lead removal                 | GHL fields exist: Validation Status, Validation Summary, DS Deck Link, Qualification Decision |
| Lookups     | Read users (for lead owners) and calendars (for the booking link on the deck's last slide)                  | To be built                                                                                   |

### Capabilities

CRMs differ, so each adapter declares what it supports: sequences, calendars, lead assignment, booking cancellation. Where a CRM lacks one, the app hides the feature or shows it as unavailable. How far to go here is **to be scoped** (question 11); this spec fixes only that the declaration exists and names those four.

### Known facts about the GHL side

From the handover and both meetings:

- The pipeline, 10 workflows and the email sequences are built and published.
- GHL holds a new lead until a verdict is written, then releases it into the sequence.
- GHL assigns leads to reps by round-robin and routes calendars per rep. The pool currently holds one placeholder user.
- GHL moves a lead to nurture after two weeks without a booking or activity.
- GHL uses both a stage and a status per lead (for example stage "Discovery Session Booked", status "Appointment - Confirmed").
- The app's stage names follow the GHL pipeline Lean built.
- Forms, calendars, email and SMS sequences and lead assignment stay in GHL.

### Rules the adapter block keeps

- No block except the adapters names a CRM, a CRM field or a CRM stage.
- Inbound webhooks are verified before they are trusted.
- Credentials are stored per Workspace and never reach the browser.
- A lead imported twice does not duplicate (source plus external ID, spec 09).
- The same event delivered twice has the effect of one.

## States

| State                        | Behaviour                                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not connected (empty)        | The Workspace has no CRM Connection. No leads arrive. The app says a CRM must be connected (screen in spec 16).                                                       |
| Connecting                   | Credentials are being checked.                                                                                                                                        |
| Connected, healthy           | Events flow in and updates flow out.                                                                                                                                  |
| Importing (loading)          | Existing leads are being pulled. Progress and a final count are reported. Import can be run again safely.                                                             |
| Connection unhealthy (error) | Credentials rejected or the CRM unreachable. The Connection's sync status says so. Updates out are not lost; see below.                                               |
| Update out failed            | The app's change stands (the app owns the lead). The failure is recorded on the lead's timeline and the update is retried. How often and for how long is not decided. |
| Event rejected               | A webhook that fails verification is refused and changes nothing.                                                                                                     |
| Event for an unknown lead    | Assumed: the lead is created from the event, as an import of one.                                                                                                     |
| Capability missing           | The feature that needs it is hidden or shown as unavailable.                                                                                                          |
| Conflict                     | Both sides changed the same thing. Not specified: this is question 1.                                                                                                 |

## Data

| Entity     | Read                                           | Written                                                                                        |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Connection | provider, credentials reference                | type "crm", provider, credentials reference, sync status                                       |
| Lead       | external ID, stage, status, exit (to send out) | Created on import and "lead created"; source, external ID, contact fields, form answers, owner |
| Booking    | state (to send a cancellation)                 | Created and updated from booking events: kind, time, state                                     |
| Verdict    | result, summary (to send out)                  | Nothing                                                                                        |
| Deck       | view link (to send out)                        | Nothing                                                                                        |
| User       | email (to match a CRM user)                    | external CRM user ID                                                                           |
| Activity   | Nothing                                        | An entry with actor "CRM" for each event applied; an entry for each failed update              |

**GHL field mapping, as far as it is known:**

| App value                  | GHL field                                             |
| -------------------------- | ----------------------------------------------------- |
| Verdict result             | Validation Status                                     |
| Verdict summary            | Validation Summary                                    |
| Deck view link             | DS Deck Link                                          |
| Qualified or not qualified | Qualification Decision                                |
| Stage                      | Pipeline stage. **Mapping not defined (question 1).** |

## Assumptions

- **Question 1:** the app owns the stage and pushes it out. Which CRM-side changes flow back, and who wins when both change, are open. Until answered, "stage changed" events from the CRM are received but what they do is unspecified.
- **Question 1:** the stage mapping between the app and GHL is open. The app's six stage names follow Lean's pipeline, which suggests a one-to-one mapping, but the one known GHL example ("Discovery Session Booked") already differs in wording from the app's "Discovery Call Booked".
- **Question 5:** the app cancels spam bookings and removes spam leads through the adapter. The alternative is that the app only writes the verdict and a GHL workflow reacts, in which case "booking cancellation" and "lead removal" leave Updates out.
- **Question 5:** the polite note sent to a spam lead is assumed to be sent by the CRM, since email stays in the CRM. Not stated in the handoff.
- **Question 11:** GHL first, Zoho next, no n8n.
- **Question 11:** the four named capabilities are the whole list for now.
- **Question 8:** the status inside a stage, and which booking events set it, is open.
- **Question 4:** whether a suspect verdict leads to a booking cancellation.
- **Question 7:** matching a user to a CRM user by email, repeated at each sign-in for Authority Solutions so that removing someone in GHL removes them here, is proposed (spec 12).
- **Question 9:** credentials are per Workspace.
- Nurture after two quiet weeks is done by GHL today. Whether the app or the CRM owns that move for other CRMs is not decided; the handoff labels the Nurture exit Ready and automatic.
- The GHL credential type is not chosen.
- Whether a GHL calendar can be embedded on the deck's last slide is part of question 2 (spec 13).

## Acceptance checks

To run when this spec is built.

1. A search of the code outside the adapter block finds no "GoHighLevel", "GHL", GHL field name or GHL stage name.
2. A second, fake adapter written only against the contract can be connected, and the Pipeline, Lead detail and Suspect review work on its leads with no change outside the adapter block.
3. Importing from GHL twice leaves each lead once.
4. A new lead in GHL appears in the app with source, external ID, contact fields, form answers and owner.
5. A booking made, cancelled, rescheduled and missed in GHL each change the lead's booking in the app and add a timeline entry with actor "CRM".
6. Writing a verdict in the app sets Validation Status and Validation Summary on the GHL contact, and GHL then releases the held lead into its sequence.
7. A deck link, a qualification decision and a stage change in the app each appear in GHL.
8. A webhook with a bad signature is refused and nothing changes.
9. The same webhook delivered twice changes the lead once.
10. With GHL unreachable, a rep's action in the app still succeeds, the timeline records the failed update, and the update arrives once GHL is back.
11. With credentials revoked, the Connection reports unhealthy.
12. No API response and no browser request contains a CRM credential.
13. An adapter that declares no booking cancellation causes the app to show that feature as unavailable rather than failing.

## User Stories

1. As a rep, I want leads from my company's CRM to appear in the app, so that I never open the CRM.
2. As a rep, I want a lead's booking to show in the app as soon as it is made, so that I can prepare.
3. As a rep, I want no-shows, cancellations and reschedules reflected in the app, so that I know where a lead stands.
4. As a rep, I want my decisions to reach the CRM on their own, so that its sequences act on them.
5. As a rep, I want the verdict written to the CRM, so that a held lead is released without me.
6. As a rep, I want the deck link stored on the contact, so that the CRM's emails can include it.
7. As a rep, I want a spam lead's booking cancelled without my doing it in the CRM, so that my calendar is cleared.
8. As a rep, I want my action to succeed even if the CRM is down, so that I am not blocked.
9. As a rep, I want to see on the timeline when an update did not reach the CRM, so that I am not surprised later.
10. As an admin, I want to connect our CRM once, so that leads start flowing.
11. As an admin, I want to see whether the connection is healthy, so that I know when to act.
12. As an admin, I want to import existing leads, so that the app starts with our pipeline.
13. As an admin, I want a second import not to duplicate leads, so that I can run it again safely.
14. As an admin, I want leads to keep the owner the CRM assigned, so that reps see their own.
15. As a customer on a CRM without calendars, I want the app to say a feature is unavailable rather than break, so that I can still use the rest.
16. As a customer, I want our CRM credentials kept on the server, so that they cannot leak.
17. As a customer, I want forged events refused, so that nobody can inject leads.
18. As a developer of another block, I want one contract for every CRM, so that I never write CRM-specific code.
19. As a developer, I want each adapter to declare its capabilities, so that screens can adapt.
20. As a developer adding a second CRM, I want to write one adapter and change nothing else, so that the product scales.
21. As the project lead, I want the GHL work Lean has done kept, so that the adapter approach does not waste it.
22. As Lean, I want to know exactly which events the app expects and which fields it writes, so that I can build the workflows to match.

## Implementation Decisions

- **One contract, expressed as the five jobs**, with one adapter per provider behind it. A Workspace's CRM Connection names the provider and that selects the adapter.
- **GHL is the only adapter built.** The contract must not contain anything GHL-specific; a fake adapter used in tests proves it (acceptance check 2).
- **Events in** arrive at one Route Handler per provider. It verifies the webhook, translates it to an app event and hands it to the block that owns the change (Pipeline for stage and booking, lead store for a new lead). Handling is inline and idempotent; there is no job queue (as decided for spec 08).
- **App events** are a fixed list: lead created, booking made, no-show, cancelled, rescheduled, stage changed. Their payloads use app vocabulary only.
- **Updates out** are requested by other blocks in app vocabulary (set verdict, set deck link, set stage, cancel booking, remove lead). The adapter translates them. The app's own write is committed first; the outbound update follows and its failure never undoes the app's write.
- **Failed updates out** are recorded and retried. The retry policy is not decided; polling or retrying on a schedule would use a scheduled job that calls a Route Handler.
- **Import** is repeatable and keyed on source and external ID.
- **Lookups** return users (id, name, email) and calendars (id, name, booking link) in app vocabulary.
- **Capabilities** are a declared set per adapter, readable by the interface through the normal data path.
- **Stage mapping** is held as data per Connection, not written into code, so the "map stages" action planned for the settings screen (spec 16) has something to edit. Proposed.
- **Credentials** are referenced from the Connection and read only on the server (spec 09).
- **Authorization.** Every adapter operation started by a user goes through a data-access function with the usual guards (ADR-0002). Webhooks are authorized by signature and resolved to a Workspace by the Connection they belong to.
- **GHL webhooks** are sent by workflows Lean builds. The list of events and their payloads must be agreed with Lean before the GHL adapter is built.

## Testing Decisions

_Seams confirmed by the owner._

- A good test drives the contract and checks the lead store and the calls made to the CRM, without reference to how the adapter is written.
- **Contract tests**, with Vitest: one suite written against the contract and run against every adapter, starting with a fake one and the GHL one. Covers the five jobs, idempotent import and events, and capability declarations.
- **Webhook Route Handler**, with Vitest: bad signature refused; each event translated; duplicates harmless.
- **Data-access functions** for updates out: the app's write stands when the CRM call fails; the failure is recorded.
- GHL itself is stubbed at the HTTP boundary. Real GHL behaviour is checked by hand with Lean against a test sub-account.
- No end-to-end browser suite yet.

## Out of Scope

- Any adapter other than GHL (Zoho is assumed next, question 11).
- n8n or any automation tool between the app and the CRM.
- The app's own email, SMS, forms or calendars. These stay in the customer's CRM.
- The app assigning leads to reps.
- The settings screen where a CRM is connected and stages are mapped (spec 16).
- Conflict resolution rules (question 1).
- What a CRM without sequences or calendars needs from the app (question 11).
- Adapters for the proposal, invoice and deck tools (question 10).
- Anything in the current build.

## Further Notes

- Zach's plan from 5 October has Lean building on GHL as the backend. The adapter approach keeps that work, but the product direction behind it was set on 7 October and has not been agreed by anyone outside the handoff. It is to be raised at the next meeting.
- The architecture review settled, on 7 October, that all CRM traffic goes through one block and that for Authority Solutions GHL assigns leads to reps.
- The prototype's "Written to GoHighLevel" panel was a teaching aid showing these updates; in the product they surface only as timeline entries that do not name the CRM.
