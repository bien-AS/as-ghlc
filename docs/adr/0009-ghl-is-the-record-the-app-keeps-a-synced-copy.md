---
status: accepted
---

# GoHighLevel is the record; the app keeps a synced copy and writes back through one path

GoHighLevel (GHL) holds the contacts, the opportunities, the pipeline, every workflow, the calendars and every message to a client. The app is where people decide. Screens never wait on GHL: they read the app's own Postgres copy of each lead, which is kept in step three ways:

1. **Webhooks.** GHL workflows post four events (contact created, appointment booked, no-show or cancelled, stage changed). The handler verifies the request, records it, answers 200 at once and hands the work to Inngest, because GHL retries only on 429 and drops an event after a 5xx. The payload carries no record, so the job reads the contact and opportunity back from the API.
2. **A one-time import** of the existing pipeline, safe to run again.
3. **A nightly reconcile** that re-reads every open opportunity and corrects any drift a missed webhook left. Mitchell raised speed on the 9 October call; this is how the copy stays fast without going stale silently.

Each field has one owner. GHL decides stages it moves (New Lead, Discovery Call Booked, Proposal Review Booked, Nurturing), the Lead Status picklist and bookings; the app mirrors them. The app decides verdicts, qualification, proposal sent and proposal signed, and GHL receives them. The app never sends an email or SMS and does not hold the scope to.

Every write to GHL goes through one module with one function per write type. Each call carries an idempotency key derived from the lead and the decision, and every attempt is logged in `ghl_sync_log` with its payload, result and retry count. A duplicate stage write would fire Lee's workflows twice and email the client twice, so replay safety is proven against the dev location before anything depends on it.

## Considered Options

- **Read GHL live on every screen.** Rejected: GHL slows under load (Mitchell, Bien on 9 October), and a rep's click should never wait on it.
- **The app owns the stage and pushes it out.** Rejected: that was the earlier multi-CRM design. GHL's workflows react to stages, so GHL must stay their owner.
- **Webhooks only.** Rejected: a dropped webhook would leave a lead wrong with nothing to notice it.

## Consequences

- Conflicts are settled by the field's owner, not by timestamps.
- IDs (pipeline, stages, custom fields, calendars) differ between the dev and production locations. They are resolved from configuration per environment at startup and never compiled in.
- The sync log is a screen (`/admin/sync-log`), not a debug file: it is the visible seam the prototype promised.
