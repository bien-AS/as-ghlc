# Fathom API research: recordings, transcripts and matching to GHL bookings

Read on 2026-10-19. API: Fathom External API, OpenAPI `info.version` "1.0.0", base URL `https://api.fathom.ai/external/v1` ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)). The newest developer changelog entry is July 2026, which added recording downloads and the users endpoint ([changelog](https://developers.fathom.ai/changelog)). The official TypeScript SDK is `fathom-typescript`. The docs pin 0.0.30 ([SDK maturity](https://developers.fathom.ai/sdks/breaking-changes/sdk-maturity)), and npm's latest is 0.0.43, published 2026-07-29 ([npm registry](https://registry.npmjs.org/fathom-typescript)).

Sources: Fathom's developer docs at developers.fathom.ai (linked from the Fathom pricing page as "Public API & MCP"), the OpenAPI spec they publish, the Fathom help center (help.fathom.video) and the pricing page. Anything these do not state is marked **unconfirmed**.

## Summary and recommended integration shape

- **Auth:** Use API keys, not OAuth. Keys belong to one user and see only what that user can view in Fathom. There are no org-level keys ([FAQ](https://developers.fathom.ai/faq)). OAuth is meant for public apps that other Fathom customers install. OAuth apps also cannot use `include_transcript` or `include_summary` on `/meetings` ([FAQ](https://developers.fathom.ai/faq)).
- **Account setup:** Run one integration identity with "all teams" View Access. Lock the org's external-meeting visibility so reps' sales calls are shared to a team when the call finalizes. A key can never read private calls ([Quickstart](https://developers.fathom.ai/quickstart)). Keep per-rep keys only as a fallback.
- **Ingestion:** Use webhooks for speed, with a polling reconciler behind them.
  - Register one `newMeeting` webhook with `include_transcript`, `include_summary` and `include_action_items` set to true. Verify the Standard-Webhooks-style HMAC signature, dedupe on the `webhook-id` header and hand the work to Inngest.
  - Webhooks fire only once per meeting. They never fire again after edits or visibility changes, and do not fire at all if no summary was generated ([FAQ](https://developers.fathom.ai/faq)).
  - The retry schedule is unpublished ([FAQ](https://developers.fathom.ai/faq)). So an Inngest cron should also page `GET /meetings?created_after=…&recorded_by[]=…` and upsert by `recording_id`.
- **Matching:** No calendar event ID is exposed. The `Meeting` schema has none ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)). Match on:
  - `calendar_invitees[].email` equal to the lead's email (case-insensitive), and
  - `scheduled_start_time` within ±10 min of the GHL appointment start, and
  - `recorded_by.email` equal to the assigned rep, as a tie-breaker.
  - Anything weaker (domain only, time only, or several candidates) stays unmatched. The full rule is in section 4.

## 1. Access

**How keys work**

- Each user generates an API key in User Settings → API Access (`https://fathom.video/customize#api-access-header`) ([Quickstart](https://developers.fathom.ai/quickstart)).
- Every request sends the key in the `X-Api-Key` header ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)). OAuth apps send a Bearer token instead ([SDK authentication](https://developers.fathom.ai/sdks/authentication)).

**Which plans include the API**

- "API access—keys and webhooks— are included on all plans" ([FAQ](https://developers.fathom.ai/faq)).
- The pricing page lists "Public API & MCP" but does not map it to plans in its static HTML ([pricing](https://www.fathom.ai/pricing)).
- Team-scoped webhook triggers are "Team Plans only" ([openapi.yaml, `triggered_for`](https://developers.fathom.ai/api-reference/openapi.yaml)). So are the org and team visibility controls described below ([External Meeting Recording Visibility](https://help.fathom.video/en/articles/6354945)).

**What a key can see**

- "API keys are scoped to the user who creates them. Your key can only access meetings you've recorded or that have been shared with you or your Team" ([Quickstart](https://developers.fathom.ai/quickstart)).
- Admins can read all users' _shared_ meetings once they are given View permissions ([Quickstart](https://developers.fathom.ai/quickstart)). Keys "_never_ grant access to other users' private meetings" ([Quickstart](https://developers.fathom.ai/quickstart); [help: Public API](https://help.fathom.video/en/articles/8368641)).
- There are no org-level keys. For org-wide access, Fathom says to give one or more Admins view access to all shared calls and use that Admin's key ([FAQ](https://developers.fathom.ai/faq)).

**Key lifecycle**

- A key keeps working if the user leaves a team or downgrades. Only what it can see changes ([FAQ](https://developers.fathom.ai/faq)).
- A deactivated user's key returns 4xx ([FAQ](https://developers.fathom.ai/faq)).
- Admins cannot revoke another user's key ([FAQ](https://developers.fathom.ai/faq)).

**Permission model**

- Permissions are two independent settings ([Team Admin Role](https://help.fathom.video/en/articles/10783489)):
  - Settings Access: Account Admin, Team Admin or Standard.
  - View Access: own meetings, one team, multiple teams or all teams.
- The API shows the same model through `GET /users`. That endpoint is account-admin only ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)).

**Recommended setup for several reps**

1. Use a Team-type plan. Put the reps in a "Sales" team.
2. Under Organization Settings or Team Settings, set External meeting visibility to "User's Team" or "All Teams" and lock it. Once locked, reps cannot pick Private ([External Meeting Recording Visibility](https://help.fathom.video/en/articles/6354945); [Auto-capture and Team Visibility](https://help.fathom.video/en/articles/13729025)). External meetings are those with at least one participant outside your email domain ([Auto-capture and Team Visibility](https://help.fathom.video/en/articles/13729025)). Auto-capture can be set the same way, separately for External, Internal and Unscheduled meetings ([Auto-capture and Team Visibility](https://help.fathom.video/en/articles/13729025)).
3. Give one integration user View Access "all teams", or just the Sales team. That user generates the key and registers the webhook.
4. Store the key as a server secret.

Unconfirmed for this setup:

- Whether a dedicated integration user needs a paid seat.
- Who the key belongs to if that person leaves. Fathom says the key dies when the user is deactivated ([FAQ](https://developers.fathom.ai/faq)), so a named employee's key is a continuity risk.

**OAuth (not recommended here)**

- You register the app at `fathom.video/marketplace_applications/new`. Apps are "subject to review" ([OAuth](https://developers.fathom.ai/oauth)).
- The scope is `public_api` and the token endpoint is `POST https://api.fathom.ai/external/v1/oauth2/token` ([SDK OAuth](https://developers.fathom.ai/sdks/oauth)).
- Refresh tokens are one-time-use and rotate. Concurrent refreshes fail with 400 ([FAQ](https://developers.fathom.ai/faq)).
- For an internal tool, Fathom points to API keys instead ([FAQ](https://developers.fathom.ai/faq)).

## 2. Endpoints

All paths below are relative to `https://api.fathom.ai/external/v1`. Source for this section: [openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml) unless noted.

| Method & path                                            | Purpose                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /meetings`                                          | List meetings. Optionally include transcript, summary, action items, highlights and CRM matches inline. |
| `GET /recordings/{recording_id}/transcript`              | Transcript for one recording.                                                                           |
| `GET /recordings/{recording_id}/summary`                 | Default-template summary for one recording.                                                             |
| `POST /recordings/{recording_id}/download`               | Start an async video/audio file export (added July 2026).                                               |
| `GET /recordings/{recording_id}/downloads/{download_id}` | Poll an export.                                                                                         |
| `GET /meeting_types`                                     | List meeting-type names, for the `meeting_type` filter.                                                 |
| `GET /teams`, `GET /team_members?team=`                  | List teams and team members.                                                                            |
| `GET /users`                                             | Users and their permissions (account admin only, otherwise 403).                                        |
| `POST /webhooks`, `DELETE /webhooks/{id}`                | Create or delete a webhook.                                                                             |

There is no "get meeting by id" endpoint and no endpoint to delete a recording. A meeting is reached by listing; transcript, summary and download are reached by `recording_id`.

### `GET /meetings`: filters

| Filter                                                                                                       | What it does                                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `created_after`, `created_before`                                                                            | ISO timestamps compared against `created_at`. This is the only date filter. You cannot filter by scheduled time. |
| `recorded_by[]`                                                                                              | One or more recorder emails. Repeat the parameter for each value.                                                |
| `teams[]`                                                                                                    | One or more team names.                                                                                          |
| `calendar_invitees_domains[]`                                                                                | Exact match on company domain. Fathom notes that a meeting is "only associated with one company".                |
| `calendar_invitees_domains_type`                                                                             | `all`, `only_internal` or `one_or_more_external`.                                                                |
| `meeting_type`                                                                                               | Meeting-type name.                                                                                               |
| `cursor`                                                                                                     | Pagination cursor.                                                                                               |
| `include_transcript`, `include_summary`, `include_action_items`, `include_highlights`, `include_crm_matches` | Booleans, default false.                                                                                         |

- If neither `recorded_by[]` nor `teams[]` is passed, "calls from users external to your Org will not be returned".
- There is **no filter by attendee email**. Fathom says this is "Not yet" supported ([FAQ](https://developers.fathom.ai/faq)).

### Pagination

- Cursor-based. Responses carry `{ items, limit, next_cursor }`. Pass `next_cursor` back as `cursor`.
- Page size is fixed at 10 and cannot be raised. There is no bulk endpoint ([FAQ](https://developers.fathom.ai/faq)).

### `Meeting` object (key fields)

**Identity and links**

- `recording_id` (integer).
- `url`: the Fathom call page.
- `share_url`: the public share link.
- `meeting_url`: the Zoom/Meet/Teams/Slack join URL from the calendar event, or `null` when there is no calendar meeting.
- The ID in a `/calls/…` URL is not the `recording_id` ([FAQ](https://developers.fathom.ai/faq)).

**Titles and type**

- `title`, `meeting_title` (the calendar event title, nullable) and `meeting_type`.

**Times** (`date-time`)

- `created_at`, `scheduled_start_time`, `scheduled_end_time`, `recording_start_time`, `recording_end_time`.

**People**

- `calendar_invitees[]`, each with `{ name, email, email_domain, is_external, matched_speaker_display_name }`.
- `recorded_by`, with `{ name, email, email_domain, team }`.
- `calendar_invitees_domains_type`.
- `shared_with`: `no_teams`, `single_team`, `multiple_teams` or `all_teams`.

**Content**

- `transcript_language`, plus the optional `transcript`, `default_summary`, `action_items`, `highlights` and `crm_matches`.

### Transcript

- Fetch it with `GET /recordings/{id}/transcript`, which returns `{ transcript: TranscriptItem[] }`, or inline through `include_transcript`.
- Each turn is `{ speaker: { display_name, matched_calendar_invitee_email|null }, text, timestamp }`.
  - `timestamp` is `HH:MM:SS` relative to the start of the meeting.
  - There is no end time per turn and no stable speaker ID.
  - `matched_calendar_invitee_email` is null when there is no exact match.
- Adding `destination_url` makes the call async: Fathom POSTs the result to that URL instead of returning it.

### Summary

- `GET /recordings/{id}/summary` returns `{ summary: { template_name, markdown_formatted } }`. `markdown_formatted` is "Always displayed in English".
- It is always the account's **default** template. You get one summary per recording, Markdown only, and changing the template in the UI does not change what the API returns ([FAQ](https://developers.fathom.ai/faq)).

### Action items

Action items are only available inline, through `include_action_items` on `/meetings` or the webhook. Each item has:

- `description`, which is always English.
- `user_generated` and `completed`.
- `recording_timestamp` (HH:MM:SS) and `recording_playback_url`.
- `assignee`: `{ name, email, team }`, all nullable.

### Recording URLs and files

- Store `share_url` and `url`.
- File export is `POST …/download`, which returns `202` and `{ download_id, status: processing|completed|failed|expired }`.
  - A completed export carries `video` or `audio`: `{ url, content_type, file_size_bytes, expires_at }`.
  - Signed URLs expire after about 24 h.
  - Limited-access shares get 403.
  - Only the API client that created the download can read it.

## 3. Webhooks

**Event**

- There is a single event: "New meeting content ready" (`newMeeting`) ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)).
- It fires "when a recording finalizes (the same event that triggers the summary email). One event per new meeting." There is no published delivery window ([FAQ](https://developers.fathom.ai/faq)).
- "No post-call summary means no webhook" ([FAQ](https://developers.fathom.ai/faq)).

**Payload**

- The body is the full `Meeting` object.
- `transcript`, `default_summary`, `action_items` and `crm_matches` are inline when the webhook's matching `include_*` flags are true ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml); [Webhooks](https://developers.fathom.ai/webhooks)).
- The schema requires `recording_id`, but the published example payload omits it. Verify against a real delivery.
- The payload does not say which user's webhook produced it. Fathom recommends a separate destination URL per user ([FAQ](https://developers.fathom.ai/faq)).

**Registration**

- In the UI: User Settings → API Access → Manage → Add Webhook ([Webhooks](https://developers.fathom.ai/webhooks)).
- Via the API: `POST /webhooks` with `{ destination_url, triggered_for[], include_transcript, include_summary, include_action_items, include_crm_matches }`. At least one `include_*` must be true ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)).
- The response holds `id` and `secret` (`whsec_…`). The `id` cannot be retrieved later, so save it if you want to delete the webhook via the API ([FAQ](https://developers.fathom.ai/faq)).
- Webhooks are per user, since each is tied to the user's API key and settings ([Webhooks](https://developers.fathom.ai/webhooks)).

**`triggered_for` values** ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml))

- `my_recordings`
- `shared_external_recordings`
- `my_shared_with_team_recordings` (Team Plans only)
- `shared_team_recordings` (Team Plans only): "All recordings you can access from other users on your Team Plan".

**Signature**

- Headers: `webhook-id`, `webhook-timestamp` (epoch seconds) and `webhook-signature` (`v1,<base64>`, possibly several separated by spaces) ([Webhooks](https://developers.fathom.ai/webhooks)).
- To verify ([Webhooks](https://developers.fathom.ai/webhooks)):
  1. Build `${id}.${timestamp}.${rawBody}` from the **raw** request body.
  2. Base64-decode the secret after `whsec_`.
  3. Compute HMAC-SHA256 and base64-encode it.
  4. Compare in constant time against each signature in the header.
  5. Reject timestamps more than 5 min off.
- The SDK provides `Fathom.verifyWebhook(secret, headers, body)` ([Webhooks](https://developers.fathom.ai/webhooks)).
- In a Next.js route handler, read the body with `await req.text()` before parsing it.

**Retries and delivery guarantees**

- Non-2xx responses and timeouts "may trigger retries". The schedule and attempt count are unpublished ([FAQ](https://developers.fathom.ai/faq)).
- Retries keep the same `webhook-id`, so use it to dedupe. You cannot re-send a webhook manually ([FAQ](https://developers.fathom.ai/faq)).
- Webhooks do not re-fire on later transcript or summary edits or on visibility changes ([FAQ](https://developers.fathom.ai/faq)).
- Visibility "at the moment the call finalized" decides whether a team-scoped webhook fires ([FAQ](https://developers.fathom.ai/faq)). This is why visibility should be locked by the org (section 1).
- You cannot add custom headers ([FAQ](https://developers.fathom.ai/faq)).
- A "Send test payload" button exists in settings ([FAQ](https://developers.fathom.ai/faq)). The webhooks page still calls it "Coming soon" ([Webhooks](https://developers.fathom.ai/webhooks)).

## 4. Matching a recording to the booking and the lead

### Available fields

All from the `Meeting` object ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)):

| Need                   | Fathom field                                                         | Notes                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Scheduled start/end    | `scheduled_start_time`, `scheduled_end_time`                         | Comes from the calendar event. Whether it is null for unscheduled calls is **unconfirmed**: the schema marks it required but not nullable. |
| Actual start/end       | `recording_start_time`, `recording_end_time`                         | Use as a fallback when the meeting was rescheduled or started late.                                                                        |
| Invitees with emails   | `calendar_invitees[].email`, `.email_domain`, `.is_external`         | `email` is nullable.                                                                                                                       |
| Lead spoke on the call | `transcript[].speaker.matched_calendar_invitee_email`                | Exact match only, otherwise null.                                                                                                          |
| External domain        | `calendar_invitees_domains_type`, `calendar_invitees[].email_domain` | Filter `calendar_invitees_domains[]` (one company per meeting).                                                                            |
| Title                  | `meeting_title` (calendar title), `title`                            |                                                                                                                                            |
| Join link              | `meeting_url`                                                        | Matches exactly if the GHL appointment stores the same Zoom/Meet link. Whether GHL exposes it is not covered here.                         |
| Rep                    | `recorded_by.email`                                                  |                                                                                                                                            |
| Calendar event ID      | **none**                                                             | Not in the schema.                                                                                                                         |

### Recommended rule

All comparisons use lowercased, trimmed emails and UTC times.

**1. Candidates.** Take meetings where `recorded_by.email` is the booking's assigned rep (or any rep, if unassigned) and `created_at` falls between booking start − 2 h and booking end + 24 h.

**2. Score each candidate.**

- **A, exact (+3):** `meeting_url` equals the GHL appointment's join URL.
- **B, lead invited (+3):** some `calendar_invitees[].email` equals the lead email.
- **C, on time (+2):** |`scheduled_start_time` − booking start| ≤ 10 min. If there is no scheduled time, use `recording_start_time` within booking start − 15 min to booking end + 30 min (+1).
- **D, lead spoke (+1):** some `transcript[].speaker.matched_calendar_invitee_email` equals the lead email.
- **E, domain only (+1):** some invitee `email_domain` equals the lead's domain and the domain is not a free-mail provider. This only adds evidence; it never counts as B.

**3. Decide.**

- **Auto-match** when the score is ≥ 5 and includes B or A, and no other candidate scores ≥ 5. The typical case is B + C.
- **Suggest, but leave unmatched** at 3–4, or when more than one candidate scores ≥ 5.
- Otherwise the recording stays **unmatched**.
- Store the score and the signals that fired with the match, so the manual rematch UI can show why.

**Things that will push calls to unmatched**

- Leads who book with one email and join from another. Example: a personal email in GHL and a work calendar invite.
- Impromptu calls with no calendar event.
- Rescheduled meetings where the calendar time moved but GHL did not.
- `calendar_invitees` reflects the calendar invite, not who actually joined.

## 5. Limits

**Rate limits** ([API overview](https://developers.fathom.ai/api-overview))

| Bucket                                                                                                            | Limit                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Global                                                                                                            | 60 calls per 60 s. 429 responses carry `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and `Retry-After`. |
| Heavy requests (transcript and summary endpoints, and `/meetings` with `include_transcript` or `include_summary`) | 30 per 60 s, possibly cut to 5 per 60 s "during periods of elevated activity".                                        |
| Download requests                                                                                                 | 30 per 60 s.                                                                                                          |

- The sources disagree on how limits are counted. The help center says "60 calls per minute across all of their API keys" per user ([help: Public API](https://help.fathom.video/en/articles/8368641)). The FAQ says limits are "per API key or OAuth token" ([FAQ](https://developers.fathom.ai/faq)).
- No standard increases are offered ([FAQ](https://developers.fathom.ai/faq)).
- With 10 items per page and the heavy-request limit, a backfill must throttle. The Inngest step concurrency should stay well under 30 per minute.

**Data retention**

- No default retention period is stated: **unconfirmed**.
- Retention policies are Enterprise-only and set up through support. Recordings older than the period are "permanently deleted" ([Retention Policies](https://help.fathom.video/en/articles/6057089)).
- A deleted call "cannot be recovered" ([Deleting a Call Recording](https://help.fathom.video/en/articles/4290753)).
- Account deletion removes recordings and metadata, and backups are cleared after 7 more days ([Is Fathom secure?](https://help.fathom.video/en/articles/296512)).

**Transcript delay**

- Transcripts exist only after post-call processing; there is no live transcript ([FAQ](https://developers.fathom.ai/faq)).
- Fathom does not publish a delivery window ([FAQ](https://developers.fathom.ai/faq)). A typical delay in minutes is **unconfirmed**.

**Languages**

- Transcripts in 38 languages ([languages](https://help.fathom.video/en/articles/296192)).
- In the UI, summaries can be translated for Spanish, Portuguese, German, French, Italian and Dutch ([languages](https://help.fathom.video/en/articles/296192)).
- Through the API, `markdown_formatted` and action-item `description` are "Always displayed in English" ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)).
- `transcript_language` gives the detected language ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)).

## 6. Data and compliance

**Recording consent**

- Fathom says there is "no way to silently record". It shows a bot, a banner or an in-chat notice ([Can I record without permission?](https://help.fathom.video/en/articles/6150977)).
- Optional consent emails go to external attendees 24 h before scheduled meetings. They are not sent for same-day or impromptu meetings ([Automatically Requesting Recording Consent](https://help.fathom.video/en/articles/294272)).
- A "No" turns off auto-record for that call ([Automatically Requesting Recording Consent](https://help.fathom.video/en/articles/294272)).
- Fathom advises consulting a lawyer about the laws where you operate ([Automatically Requesting Recording Consent](https://help.fathom.video/en/articles/294272)).
- The consent decision is not exposed in the API schema ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)). So the app cannot show "lead consented" from Fathom data.

**PII**

- Transcripts, invitee names and emails, and CRM matches are personal data. Whatever we copy into Supabase falls under our own retention and access controls.
- The pasted-transcript fallback brings in the same kind of data.

**Deletion**

- There is no delete endpoint and no deletion webhook ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)). A call deleted in Fathom leaves our copy in place, and its `share_url` will stop working.
- We need our own deletion path, and a periodic check that stored recordings still exist. Re-listing is the only signal available.

**Vendor posture**

- Fathom states it is "HIPAA, SOC2 Type II, and GDPR-compliant". All data is stored in the US, and a DPA is available through trust@fathom.video ([Is Fathom secure?](https://help.fathom.video/en/articles/296512)).
- AI sub-processors (Anthropic, OpenAI, Google) are not permitted to train on customer data ([Is Fathom secure?](https://help.fathom.video/en/articles/296512)).
- Fathom itself uses de-identified customer data to improve its own models unless the org opts out in Organization Settings ([Is Fathom secure?](https://help.fathom.video/en/articles/296512)).

## Open questions and risks

1. **Coverage through one admin key.** Does a `shared_team_recordings` webhook on an "all teams" View Access user fire for every team-shared call, including teams that user is not a member of? The wording suggests yes ("All recordings you can access…") ([openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)) but it is unconfirmed. Test with two reps before building.
2. **Private calls.** A rep's private call is invisible to any key but their own ([FAQ](https://developers.fathom.ai/faq)). The fix is a locked org visibility setting. If that is not acceptable, fall back to per-rep keys and per-rep webhook URLs.
3. **Seat for the integration user.** Unconfirmed. Ask Fathom sales whether a non-recording admin needs a paid seat, and pick a key owner who will not be deactivated.
4. **`scheduled_start_time` on impromptu calls.** Is it null or something else? Unconfirmed; check with a real impromptu call.
5. **`recording_id` in webhook payloads.** Required by the schema but missing from the example. Confirm on the first live delivery.
6. **No attendee-email filter, no scheduled-time filter.** Matching therefore has to happen on our side, over a `created_at` window ([FAQ](https://developers.fathom.ai/faq)).
7. **Rate limits are low.** Heavy requests can drop to 5 per minute ([API overview](https://developers.fathom.ai/api-overview)). Backfills and the reconciler must throttle, and should prefer the inline webhook payload over re-fetching.
8. **The webhook fires once.** Transcript or summary edits made in Fathom after finalization never reach us without polling ([FAQ](https://developers.fathom.ai/faq)). Decide whether the reconciler should re-fetch recent meetings.
9. **No summary means no webhook** ([FAQ](https://developers.fathom.ai/faq)). Very short or silent calls only show up through polling.
10. **Summary language and template.** Always English and always the account default template ([FAQ](https://developers.fathom.ai/faq); [openapi.yaml](https://developers.fathom.ai/api-reference/openapi.yaml)). Pre-filling proposal values should run our own extraction over `transcript`, not depend on the summary format.
11. **Payload size.** A long call with the transcript inline makes a large webhook body. Check the Vercel function body limit, or turn `include_transcript` off on the webhook and fetch the transcript in an Inngest step.
12. **SDK is beta.** It may break between versions ([SDK maturity](https://developers.fathom.ai/sdks/breaking-changes/sdk-maturity)). Either pin it or call the REST API with `fetch` and verify signatures ourselves (about 20 lines, per [Webhooks](https://developers.fathom.ai/webhooks)).
13. **Rate-limit scope.** The help center says per user and the FAQ says per key ([help: Public API](https://help.fathom.video/en/articles/8368641); [FAQ](https://developers.fathom.ai/faq)). Treat it as per user to be safe.
14. **Default data retention.** Unstated. Ask Fathom, and decide our own retention for copied transcripts.

## Sources

- Developer docs index: https://developers.fathom.ai/llms.txt
- Introduction: https://developers.fathom.ai/
- Quickstart: https://developers.fathom.ai/quickstart
- API overview (auth, rate limits): https://developers.fathom.ai/api-overview
- OpenAPI spec (v1.0.0): https://developers.fathom.ai/api-reference/openapi.yaml
- List meetings: https://developers.fathom.ai/api-reference/meetings/list-meetings
- Get transcript: https://developers.fathom.ai/api-reference/recordings/get-transcript
- Get summary: https://developers.fathom.ai/api-reference/recordings/get-summary
- Request a download: https://developers.fathom.ai/api-reference/recordings/request-a-download
- Create a webhook: https://developers.fathom.ai/api-reference/webhooks/create-a-webhook
- Webhook payload: https://developers.fathom.ai/api-reference/webhook-payloads/new-meeting-content-ready
- Webhooks guide (verification): https://developers.fathom.ai/webhooks
- FAQ: https://developers.fathom.ai/faq
- OAuth: https://developers.fathom.ai/oauth and https://developers.fathom.ai/sdks/oauth
- SDK authentication: https://developers.fathom.ai/sdks/authentication
- SDK filtering and pagination: https://developers.fathom.ai/sdks/filtering, https://developers.fathom.ai/sdks/pagination
- SDK maturity: https://developers.fathom.ai/sdks/breaking-changes/sdk-maturity
- Changelog: https://developers.fathom.ai/changelog
- npm package metadata: https://registry.npmjs.org/fathom-typescript
- Pricing: https://www.fathom.ai/pricing
- Help: Public API: https://help.fathom.video/en/articles/8368641
- Help: Team Admin Role: https://help.fathom.video/en/articles/10783489
- Help: Auto-capture and Team Visibility: https://help.fathom.video/en/articles/13729025
- Help: External Meeting Recording Visibility: https://help.fathom.video/en/articles/6354945
- Help: Retention Policies: https://help.fathom.video/en/articles/6057089
- Help: Deleting a Call Recording: https://help.fathom.video/en/articles/4290753
- Help: Supported languages: https://help.fathom.video/en/articles/296192
- Help: Recording consent emails: https://help.fathom.video/en/articles/294272
- Help: Recording without permission: https://help.fathom.video/en/articles/6150977
- Help: Is Fathom secure?: https://help.fathom.video/en/articles/296512
