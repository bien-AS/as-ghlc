---
title: Meetings from Fathom
status: needs-clarification
sessions: S11
registry: meeting-recordings
research: docs/research/fathom-api.md (read 19 October 2026)
waiting_on:
  - Zachery or Mitchell: a Fathom integration user with "all teams" View Access, its API key, and the org setting that shares reps' external meetings with the team
  - Bien: the five checks under Open questions, on a real account, before matching is built
---

# 11. Meetings from Fathom

**Purpose:** bring each recorded call into the app, attached to the right lead and booking, with its transcript, summary and action items as meeting notes, so the rep has them on the lead and the proposal (spec 12) can be pre-filled from what the client actually said. It serves reps; admins fix matches.

Facts about Fathom's API below are from `docs/research/fathom-api.md`, which cites its sources. Where it says "unconfirmed", so does this spec.

## Access

- Fathom API keys are per user and see only what that user can view; there is no org key. So the app uses **one integration user** with View Access to all teams, and the org setting that shares reps' external meetings with the team is turned on and locked. Calls a rep keeps private stay invisible to the app.
- Base `https://api.fathom.ai/external/v1`, header `X-Api-Key`. Key in `FATHOM_API_KEY`; the webhook secret in `FATHOM_WEBHOOK_SECRET`. One module, `src/lib/services/fathom.ts`, holds every call.
- Limits: 60 calls a minute overall; transcript and summary 30 a minute, down to 5 when Fathom is busy. Jobs throttle to stay under them and back off on 429.

## Getting meetings in

1. **Webhook** "new meeting content ready" to `POST /api/webhooks/fathom`, registered for the integration user with transcript, summary and action items included. Verified with HMAC-SHA256 over the `webhook-id`, `webhook-timestamp` and `webhook-signature` headers; deduplicated on `webhook-id`; answered 200, then an Inngest job.
2. **Polling**, because the webhook fires once only (not on later edits, not when no summary was generated, not for a call shared after processing): an Inngest cron every 30 minutes lists `GET /meetings` with `created_after` set to the last run (cursor pagination, 10 a page, filtered by `calendar_invitees_domains[]` to external calls) and fetches whatever the app does not have.
3. For each meeting the job stores a `meetings` row (Fathom recording id, title, scheduled and recorded times, `recorded_by` email, invitees, share URL) and a `transcripts` row (speaker turns with name, matched invitee email if any, text, `HH:MM:SS` timestamp), the summary (Markdown) and action items. Then it runs the matching.

## Matching

Fathom exposes no calendar event id, and cannot be filtered by attendee email, so the app matches on its side:

- **Auto-match** a meeting to a lead's booking only when the lead's email is in the meeting's `calendar_invitees[].email` **and** `scheduled_start_time` is within 10 minutes of the GHL booking time.
- Supporting evidence, recorded with the match but never enough alone: `recorded_by.email` is the lead's rep, a speaker matched to the lead's email, the invitee's email domain matching the lead's.
- Anything weaker, or two strong candidates, stays **unmatched**. A wrong transcript in a proposal is worse than none.
- Each match stores its rule, its evidence and who made it (the job or an admin).

## Screens

- **Lead detail, Meetings tab:** each matched meeting with date, kind (discovery or proposal review, from the booking), the summary, action items, the transcript (searchable, by speaker), and the Fathom share link. This is the rep's meeting notes.
- **Recordings (`/recordings`):** unmatched first, then recent. Admins can **rematch** a meeting to a lead and booking, or mark it "not a sales call"; reps see their own leads' meetings read-only.
- **Paste fallback:** on a lead with no matched discovery call, the rep can paste a transcript. It is stored as a transcript with source "pasted" and feeds the proposal the same way.

## Data handling

Fathom has no delete endpoint and no deletion webhook, so the app's copies need their own rule: transcripts and summaries are kept while the lead is open and deleted 12 months after it is won or lost (assumed; Mitchell confirms). The app never shows a transcript to a rep who cannot see its lead. Summaries and action items arrive in English whatever the call's language.

## Acceptance checks

1. A call recorded by a rep, with the lead invited and booked in GHL, appears matched on the lead within 30 minutes of Fathom finishing it.
2. The same webhook delivered twice stores the meeting once; a forged or replayed one is refused and recorded.
3. A meeting the webhook missed arrives by the next poll.
4. A call where the lead's email is absent, or the start is more than 10 minutes off, stays unmatched and appears first on `/recordings`.
5. An admin rematch moves the meeting, records who did it, and a rep cannot rematch.
6. A pasted transcript feeds proposal generation exactly as a matched one does.
7. The jobs stay under Fathom's rate limits during a backfill of 200 meetings.

## Open questions (check on a real account before building matching)

1. Does one webhook on the integration user fire for every team-shared call?
2. Is `scheduled_start_time` empty for impromptu calls (no calendar event)?
3. Does the webhook payload carry `recording_id` (the documented example omits it)?
4. Does the integration user need a paid seat, and on which plan (sharing calls with a team needs a Team-type plan)?
5. Are rate limits counted per user or per key (Fathom's help center and FAQ disagree)?
6. Retention: 12 months after close, or another period? (Mitchell)
