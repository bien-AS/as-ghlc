# GHL Workstream: Lee's Lane (the connection points)

This build has one app builder (Bien + Claude Code) and one parallel GHL workstream. **Lee owns everything inside GoHighLevel**: pipelines, workflows, calendars, email sequences, the custom connector app, and the stage semantics the app mirrors. This annex is the contract between the two lanes: what the app expects from GHL, what Lee owes at each session, and when.

**Lee's working mandate (operator decision, baked in):** all GHL implementation work runs through Claude Code with the GHL browser pane: log in, state the task, let it execute. Expected ~75% time savings; legacy manual clicking is not the method of record.

## Principles

- **GHL stays the system of record** for contacts and opportunities. The app is where humans decide; every app decision writes back through the connector and lands in `ghl_sync_log` (the visible seam).
- **One direction of truth per field.** Stages and automations: GHL decides, app mirrors. Verdicts, qualification, deck/proposal/invoice state: app decides, GHL receives.
- **Nothing user-driven stays hidden in GHL.** Anything a rep would have clicked in Lee's workflows must surface in the app; if a new one appears, it gets a registry entry first (living-registry protocol).

## Connection points by session

| Session | What the app builds | What Lee owes | Due |
|---|---|---|---|
| S1 (architecture) | Connector + seam ADRs | Review the stage list and workflow triggers Claude drafts from the handoff; correct anything stale | before S2 |
| S6 (connector core) | Inbound lead webhook, outbound status/stage writes, idempotent sync, sync-log | Custom connector app + scopes on the dev location; inbound webhook configured to the app's endpoint; a test contact form wired | S6 start |
| S10 (booking slide) | GHL calendar embed on the deck's last slide | Calendar embed code/config for the dev calendar; confirmation the proposal-review calendar routes correctly | S10 start |
| S13 (signature flow) | SPT signature webhook drives invoice drafts + GHL stage update to Proposal Sent / Won path | Confirm which workflow fires on the stage write (no double emails when the app writes the stage) | S13 start |
| S14 (status engine) | Full silence-path status set + lead-age automation, Lost/Won mirror | Confirm the status map and thresholds (defaults shipped: nurture 14d unbooked, lost after no-show chase, lost 14d silent post-proposal); nurture handoff mechanics | at or before the Friday Oct 10 call (ledger item 6) |
| S16 (hardening) | Webhook signature verification, replay tests | A throwaway test location or sandbox window for destructive replay tests | S16 start |
| Launch | Production cutover | Production location connector + webhooks mirroring the dev setup; sales reps exist in GHL (population timed with deploy) | S17 |

## Stage mirror (seed; Lee corrects)

| GHL reality (Lee's build) | App status |
|---|---|
| Lead in (form) + booking link emailed | incoming |
| Discovery call booked | discovery-booked |
| Canceled / rescheduled / no-show | canceled / rescheduled / no-show (chase per GHL workflows) |
| Discovery held | discovery-held |
| Qualified / disqualified (app decision) | qualified / lost |
| Proposal review booked (deck last slide) | proposal-review-booked |
| Proposal sent (SPT) | proposal-sent |
| Signed / paid | won |
| No booking in ~14 days | nurture (separate team) |
| Silent after proposal | lost (after threshold) |

## Standing rules

- Spam/suspect decisions in the app cancel the discovery chase in GHL (single spam-removal mechanism; the app is the only place a human marks spam).
- Every app-to-GHL write type has one Inngest write path with an idempotency key; Lee should expect at-least-once delivery and no duplicates.
- Changes to pipelines/workflows after S6 are announced in #as_ghl before they land; the app's status map gets updated in `admin-statuses` (or `status_defs` seed) in the same breath.
- Deliverability (DNS, SPF, DKIM, DMARC) is its own track owned by Zachery (Mitchell backup); the GHL email sequences depend on it and it is not started. It rides the Friday agenda, not this workstream.
