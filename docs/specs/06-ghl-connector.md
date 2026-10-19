---
title: GoHighLevel connector and the sync log
status: needs-clarification
sessions: S6 (and the write-backs used by S8, S12, S13, S14)
registry: sync-log
waiting_on:
  - Bien: a read-only Private Integration Token in the production sub-account (see "Working without a dev location")
  - Lee: the four outbound webhooks pointed at a deployed preview of the app
  - Lee: whether a dev sub-account can be made; until then writes stay switched off outside supervised tests
  - Lee: a custom field for the proposal link (needed by W5, not by S6)
---

# 06. GoHighLevel connector and the sync log

**Purpose:** keep the app's copy of every lead in step with GoHighLevel (GHL), and send the app's decisions back through one logged, idempotent path. It serves every other spec: none of them calls GHL directly.

Sources: the GHL connector spec Lee and Claude wrote for Bien (claude.ai artifact `DLBk2SSpB5v38sz5vzLWne`, IDs read from production on 7 and 8 October 2026), `docs/packet/ghl-workstream.md`, ADR-0009. Where this spec and GHL's own docs disagree, a live call against the dev location decides.

## What the account looks like (read on 20 October 2026)

Looked at by Claude through Bien's browser, read-only:

- **One sub-account only**, "Authority Solutions" (`9Q6zIpMRGSX5wfUk6fjC`). There is no dev location yet.
- The New Lead Pipeline has the eight stages below and about eight opportunities, most of them tests.
- **Ten workflows.** Folder "AS CRM — Core": C1 Lead Ingestion Router (**Draft**), C1b Validation Companion, C2 Welcome & No-Response Sequence, C3 Reply Handler, C4 Appointment Confirmation & Reminders, C5 Appointment Outcome Router, C6 No-Show Recovery, C7 Cancellation Recovery, C8 Unsubscribe Handler, all published. Folder "AS CRM — Advanced": A1 Qualification Decision, published.
- **One Private Integration**, named "Claude" (Lee's working token, last used 8 October). The app has no token of its own yet.

C1 being a draft matters: the GHL spec says GHL moves a lead to New Lead "on intake", and C1 is the obvious place that happens. Lee confirms whether intake runs today and from where (question 8).

## Working without a dev location

A write to this sub-account fires Lee's published workflows, which email and text real people. So until a dev sub-account exists:

1. **The app's token is read-only:** `contacts.readonly`, `opportunities.readonly`, `locations/customFields.readonly`, `calendars.readonly`, `calendars/events.readonly`, `users.readonly`. Bien creates it under Settings, Private Integrations, named "AS Sales App (read-only)". Reads, import, reconcile and webhooks are all built and tested with it.
2. **Writes are built and tested against a stubbed GHL**, and switched off in every environment by `GHL_WRITES_ENABLED=false`. The runner records a write it would have made in the sync log as "skipped: writes disabled", so the seam is still visible.
3. **The first real writes** happen in one supervised session with Lee: a second token with the two write scopes, on test contacts Lee creates, with Lee watching which workflows fire. Acceptance check 7 is run then.
4. If Lee makes a dev sub-account, everything above moves to it, writes switch on there, and production keeps read-only until S17.

The production IDs below are the ones to configure now; a dev sub-account would get its own.

## Access

- **One Private Integration Token per location** (dev, production), created in the sub-account under Settings, Private Integrations. Not OAuth: one sub-account needs no marketplace app, and OAuth would need Agency Pro.
- **Scopes (eight):** `contacts.readonly`, `contacts.write`, `opportunities.readonly`, `opportunities.write`, `locations/customFields.readonly`, `calendars.readonly`, `calendars/events.readonly`, `users.readonly`. Not `conversations.write`: GHL sends every client email and SMS, and the app must not be able to.
- Every request: `Authorization: Bearer <token>`, `Version: 2021-07-28` (without it calls fail like auth errors), base `https://services.leadconnectorhq.com`.
- The token lives in the environment (`GHL_PRIVATE_TOKEN`), never in the repo or a table. Rotation, about every 90 days, is a config change.
- One module, `src/lib/services/ghl/`, holds every GHL call. Nothing else imports it except the connector's data-access functions and Inngest jobs.

## Configuration per environment

IDs are resolved at startup from configuration, never compiled in. `GHL_LOCATION_ID` plus a JSON config (`GHL_IDS`) naming: the pipeline id, the eight stage ids by stage name, the contact and opportunity custom field ids by key, the two calendar ids, the placeholder user id. A startup check reads custom fields (with `?model=opportunity` for the opportunity ones) and fails loudly if a configured id is missing.

Production, for reference (location `9Q6zIpMRGSX5wfUk6fjC`, New Lead Pipeline `WXWywt9GjrtX9msYUlls`):

| Pos | Stage                  | Production stage id                    | Moved by           |
| --- | ---------------------- | -------------------------------------- | ------------------ |
| 0   | New Lead               | `f3c7bbc2-2eb8-4078-a3ce-ea8a71143e30` | GHL, on intake     |
| 1   | Discovery Call Booked  | `220649d0-5d10-48ae-95b5-ce25f9f19b8c` | GHL, on booking    |
| 2   | Qualified              | `2a584436-9b56-45aa-b78e-7cf05e815033` | the app (W3)       |
| 3   | Proposal Review Booked | `e2a53688-fec1-475e-ae2c-a6b7a46299a2` | GHL, on booking    |
| 4   | Proposal Sent          | `6c8f6056-6f3b-41cd-a2ad-5c8ad9399d48` | the app (W5)       |
| 5   | Lead Won               | `ed0f2386-fcb6-491d-8dd8-5a15c39b74e9` | the app (W6)       |
| 6   | Lead Lost              | `5de89fbc-2e22-493e-849b-2149f96bdd88` | the app (W3)       |
| 7   | Nurturing              | `76ef233e-92e4-4470-94cd-1885c14aefd1` | GHL, after silence |

Contact fields used: Validation Status `contact.validation_status` (Valid, Suspect, Spam), Validation Summary `contact.validation_summary` (large text), DS Deck Link `contact.ds_deck_link`, Lead Source, Source Form ID, Ingestion Completed, Data Quality, Last Engagement, Engagement Count. Opportunity fields (visible only with `?model=opportunity`): Lead Status `opportunity.lead_status` (28 values), Qualification Decision (Qualified, Not Qualified; "Pending" is being removed, build no state for it), Appointment Status (Showed, No Show, Cancelled; "Rescheduled" is never written by GHL), Proposal Review Session (date). Production ids are in the source artifact and are copied into the production config at S17.

## The copy of each lead (ADR-0009)

- **Lead** = a GHL contact plus its opportunity in the New Lead Pipeline. The app stores contact fields it shows, `stage` (the eight above, by name), `lead_status` (the 28 Lead Status values, by name), the opportunity's assigned user, booking state, and `last_activity_at`.
- **Stage and Lead Status are mirrored, not mapped.** The app's names are GHL's names. `status_defs` seeds from the Lead Status picklist and its seven groups; it is the list the app shows, filters and validates against.
- **Import:** one admin-run job pages through the pipeline's opportunities (contacts page at 20 by default, 100 at most, cursor `startAfter` and `startAfterId`) and upserts by `ghl_opportunity_id`. Safe to run twice.
- **Nightly reconcile:** an Inngest cron re-reads every opportunity not in Lead Won or Lead Lost and corrects the copy. Each correction is a `lead_status_events` row with actor "reconcile".

## Events in

Four outbound webhooks from Lee's workflows, all to `POST /api/webhooks/ghl` with a per-location secret:

| Event                              | The app does                                                          |
| ---------------------------------- | --------------------------------------------------------------------- |
| Contact created (Get Started form) | Creates the lead and starts validation (spec 08), which ends in W1    |
| Appointment booked                 | Updates the booking; the lead shows as needing a deck (spec 09)       |
| No-show or cancelled               | Updates the booking and status; GHL runs the recovery sequence itself |
| Stage changed                      | Brings the copy in step when GHL moved the lead                       |

Handling, because GHL retries only on 429 and treats a 5xx as final:

1. Verify the request (the per-location secret; GHL's signature if the dev location shows one). Refuse and record anything unverified.
2. Insert the raw event keyed on `webhookId`; a duplicate is acknowledged and ignored.
3. Answer 200 at once and send an Inngest event.
4. The job reads the contact and opportunity back from the API (the payload carries only event fields; `customData` arrives empty) and applies the change.

## Writes out

One function per write in `src/lib/services/ghl/writes.ts`, each wrapped by the same runner: build an idempotency key from the lead and the decision, skip if `ghl_sync_log` already has it succeeded, otherwise call, record the attempt, and retry on 429 with exponential backoff honouring the `X-RateLimit-*` headers. A failed write leaves the app's decision standing, shows on the lead's timeline, and is retried from the sync log.

| Write                 | Trigger                                         | GHL change                                                                | Then GHL does                                                                                                           |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| W1 Validation verdict | Validation finishes (automatic)                 | Contact: Validation Status, Validation Summary (the research brief)       | Releases the held lead into its sequence. Spam: cancels the booking, sends the note, removes the record. Suspect: waits |
| W2 Deck link          | A deck is generated                             | Contact: DS Deck Link                                                     | Deferred to Phase 4: built, behind the flag `ghlDeckLinkWrite`, off                                                     |
| W3 Qualification      | Rep decides                                     | Opportunity: Qualification Decision; stage to Qualified or Lead Lost      | Sends the follow-up                                                                                                     |
| W4 Mark spam          | Rep marks a suspect as spam                     | Contact: Validation Status = Spam, nothing else                           | The same removal as W1's spam path. No second removal path in the app                                                   |
| W5 Proposal sent      | Rep sends the proposal (spec 12)                | Contact: proposal link field (does not exist yet); stage to Proposal Sent | Its proposal sequence                                                                                                   |
| W6 Proposal signed    | Smart Pricing Table signature webhook (spec 13) | Stage to Lead Won                                                         | Its won sequence                                                                                                        |

Shapes, to confirm in the supervised write session (or on a dev sub-account) before relying on them: contact fields by `POST /contacts/upsert` (matches on email or phone; `"new": false` on update) with `customFields: [{ id, value }]`; stage by `PUT /opportunities/{id}` with `pipelineId` and `pipelineStageId`. A move to an earlier stage (Qualified from anything later) needs GHL's previous-stage toggle, or it reports success and does nothing; the runner reads the opportunity back after every stage write and logs a mismatch as a failure.

## The sync log screen (`/admin/sync-log`)

Admin only. Every write and attempt, newest first: time, lead (links to lead detail), write type, result, attempts, idempotency key, and the payload on expand. Filters by write type and result. "Retry" on a failed write re-runs it through the same runner. Webhook events received appear in a second tab with their outcome. Every mutating modal elsewhere in the app names the write it will cause, in words, before the person confirms.

## Acceptance checks

Reads (checks 1 to 5, 10, 11) against production with the read-only token; writes (6 to 9) in the supervised session with Lee, or on a dev sub-account:

1. The startup check resolves every configured id and fails naming the missing one when an id is wrong.
2. A Get Started form submission creates the lead in the app with its contact fields, stage New Lead, and status from Lead Status.
3. Booking, cancelling and a no-show on the dev calendars each update the lead's booking and status, with a timeline entry.
4. Moving the opportunity in GHL updates the app's stage within a minute (webhook) and, with the webhook switched off, by the next reconcile.
5. The same webhook delivered twice changes the lead once. An unverified request changes nothing and is recorded.
6. W1, W3 and W4 each change GHL as specified; reading the contact and opportunity back confirms it; the sync log shows each.
7. Firing the same W3 twice (same lead, same decision) produces one GHL change and one email from Lee's workflow; this is checked by Lee.
8. A write made while GHL answers 429 succeeds after backoff; one made while GHL is unreachable stays failed, shows on the timeline, and succeeds from "Retry".
9. A move back to Qualified from a later stage either works (toggle set) or is logged as a failure; it never reports success silently.
10. Import run twice leaves each lead once.
11. No response or page in the app contains the token.

## Open questions

1. **Silence paths.** GHL moves a lead to Nurturing "after silence"; the packet's S14 has the app move leads by age (14 days unbooked to Nurturing, Lost after the no-show chase, Lost 14 days silent after the proposal). Assumed: GHL moves them and the app mirrors, showing age and thresholds only. Lee and Mitchell confirm (spec 14).
2. **Proposal link field.** W5 needs a contact field Lee has not created yet.
3. **Deck link (W2).** Deferred by the packet; Lee may contest it. Built behind a flag either way.
4. **Calendars.** Both calendar ids come from a September audit; Lee re-verifies them.
5. **Reps in GHL.** None exist yet; GHL assigns the placeholder user `c1OqILwMVMfbMStYQd0F`. Until real reps exist, `assigned_to` stays empty and only admins see unassigned leads. The mapping from GHL user to profile is `profiles.ghl_user_id`, set on the reps screen.
6. **Typeform.** The packet says intake stays on Typeform; this spec starts from GHL's Get Started form webhook. Lee confirms Typeform submissions reach GHL as that form (and so trigger "contact created").
7. **Webhook verification.** Whether GHL workflow webhooks carry a signature, or only the secret we put in the URL or a header. Checked on the first webhook Lee points at the preview.
8. **Intake.** C1 Lead Ingestion Router is a draft. Does a form submission reach the New Lead stage today, and through which workflow? (Lee)
9. **A dev sub-account.** Can the agency plan add one, and who sets it up? (Lee, Zachery)

## Out of scope

Creating or editing pipelines, stages or workflows (the API cannot). Sending any message to a client. Any CRM other than GHL. Lead assignment rules (`/admin/routing`, Phase 4).
