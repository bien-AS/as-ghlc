# Draft: columns for the 17 Drizzle tables (spec 01, for owner review)

Approved by the owner on 2026-10-20 for the first migration. Open questions keep the drafted default until the spec that needs each one settles it.

Sources: `01§4.2` = spec 01 section 4 rule 2; `06` = spec 06; `PD7` = product-doc section 7; `R:x` = registry screen x; `G` = glossary.

## Conventions used in every table

- **Primary key:** `id uuid PK defaultRandom()`, except where a table says otherwise.
- **Timestamps:** `created_at`, `updated_at` (`timestamptz not null default now()`, `updated_at` with `$onUpdate`), from one shared object (01§4).
- **Lead FK:** `lead_id uuid not null → leads.id on delete cascade`, indexed `(lead_id, created_at desc)`: lead-detail loads children latest first (R:lead-detail).
- **usage:** `model text`, `input_tokens int`, `output_tokens int`, `cost_usd numeric(12,6)`, all nullable. Null cost = not measured, never 0 (01§1).
- **Money:** `numeric(12,2)`, string mode. Null = not measured.
- **RLS:** enabled on every table with no policies, in the creating migration (01§4.6).
- **Indexes:** only uniques, scoped FKs and "latest per lead" reads. Nothing else until a query is measured slow.
- **Append-only** (`validation_runs`, `lead_status_events`): keep `updated_at` (always = `created_at`); a `BEFORE UPDATE` trigger raises. DELETE stays open so a purge can cascade.

## Enums (only where a spec fixes the set)

- `role`: admin, rep (01§4.1)
- `lead_stage`: New Lead, Discovery Call Booked, Qualified, Proposal Review Booked, Proposal Sent, Lead Won, Lead Lost, Nurturing (06)
- `verdict`: valid, suspect, spam (08, G)
- `booking_status`: booked, showed, no_show, cancelled (06)
- `booking_kind`: discovery, proposal_review (06, 11)
- `deck_group`: discovery_call, follow_up, strategy_session (09)
- `job_status`: generating, ready, failed (09, 07)
- `validation_source`: rule, model, human (08)
- `status_actor`: webhook, reconcile, import, user (06)
- `write_type`: w1_verdict, w2_deck_link, w3_qualification, w4_mark_spam, w5_proposal_sent, w6_proposal_signed (06)
- `write_result`: pending, succeeded, failed, skipped (06)
- `proposal_status`: generating, draft, sent, viewed, signed, withdrawn, lost, failed (12)
- `invoice_kind`: one_time, recurring (13)
- `invoice_status`: draft, flagged, sent, viewed, paid, failed (13)
- `match_state`: matched, unmatched, not_sales_call (11)
- `notification_type`: suspect_to_review, call_without_deck, recording_matched, recording_unmatched, proposal_viewed, proposal_signed, invoice_pair_ready, ghl_write_failed (15)
- `provider`: ghl, presenton, smart_pricing_table, invoice_ninja, fathom, openrouter (15)

Lead Status is not an enum: a FK to `status_defs`, so the 28 values stay data (06).

## profiles

| column                | type    | null/default  | constraint                                | source                  |
| --------------------- | ------- | ------------- | ----------------------------------------- | ----------------------- |
| id                    | uuid    | not null      | PK; FK `auth.users.id` on delete restrict | 01§4.1, ADR-0008        |
| email                 | text    | not null      | unique; check `email = lower(email)`      | 01§4.1                  |
| first_name, last_name | text    | not null      |                                           | 01§4.1                  |
| role                  | role    | default 'rep' |                                           | 01§4.1                  |
| active                | boolean | default true  |                                           | 01§4.1, 15              |
| ghl_user_id           | text    | null          | unique                                    | 06, 15                  |
| first_run             | boolean | default true  |                                           | 01, R:welcome-first-run |
| celebration_shown     | boolean | default false |                                           | 09                      |
| notification_prefs    | jsonb   | default '{}'  | missing key = on                          | 15                      |

## leads

| column                              | type                         | null/default | constraint                   | source            |
| ----------------------------------- | ---------------------------- | ------------ | ---------------------------- | ----------------- |
| ghl_contact_id                      | text                         | not null     | unique                       | 01§4.2            |
| ghl_opportunity_id                  | text                         | null (Q3)    | unique                       | 01§4.2, 06        |
| first_name, last_name, company_name | text                         | null         |                              | 07                |
| email, phone                        | text                         | null         |                              | 11, 12, 06        |
| website                             | text                         | null         |                              | 08, 07            |
| lead_source                         | text                         | null         |                              | 06, R:lead-list   |
| form_answers                        | jsonb                        | null         | shape is Q4                  | 08                |
| stage                               | lead_stage                   | null         |                              | 01§4.2, 06        |
| lead_status                         | text                         | null         | FK `status_defs.value`       | 01§4.2, 06        |
| verdict                             | verdict                      | null         |                              | 08                |
| assigned_to                         | uuid                         | null         | FK profiles, set null; index | 01§4.2, leadScope |
| ghl_assigned_user_id                | text                         | null         |                              | 06, 15            |
| discovery_booking_at / _status      | timestamptz / booking_status | null         |                              | 06, 11            |
| review_booking_at / _status         | timestamptz / booking_status | null         |                              | 06, 11            |
| last_activity_at                    | timestamptz                  | null         |                              | 01§4.2            |
| deleted_at, deleted_reason          | timestamptz, text            | null         |                              | 01§4, R:lead-list |

## lead_research

lead FK · status job_status default 'generating' · brief_md text · facts jsonb (claims with sources) · error text · usage. One row per run; the screen shows the latest `ready` row. (07)

## validation_runs (append-only)

lead FK · source validation_source · verdict · confidence numeric(4,3) null · patterns, reasons text[] · summary text · inputs jsonb · overridden_by FK profiles (check: set exactly when source = human) · usage. (08)

## lead_status_events (append-only)

lead FK · from_stage, to_stage lead_stage · from_status, to_status text (no FK, history survives picklist change) · actor status_actor · actor_id FK profiles · sync_log_id FK ghl_sync_log · note text. (06, PD7)

## status_defs (PK = GHL value)

value text PK · group_name text · position int · stages lead_stage[] · tone text · threshold_days int null (Q8). (06, 14)

## decks

lead FK · template_id FK deck_templates (restrict) · status job_status · presenton_task_id, presenton_presentation_id text · revision int default 1 · pdf_path, slides_path text · error text · share_token text unique · created_by FK profiles · deleted_at. (09)

## deck_templates

group deck_group · version text · manifest jsonb · active boolean; unique(group, version), partial unique(group) where active. (09)

## meetings (a Fathom recording)

fathom_recording_id text unique · title, recorded_by_email, share_url text · scheduled_start_at, recording_started_at, recording_ended_at timestamptz · invitees jsonb · summary_md text · action_items jsonb · lead_id FK null · booking_kind · match_state default 'unmatched' (matched ⇒ lead_id set) · match_rule text · match_evidence jsonb · matched_by FK profiles. (11)

## transcripts

meeting_id FK unique null · lead_id FK null (exactly one of the two set) · turns jsonb `{speaker,email?,text,ts?}[]` · created_by FK profiles. Pasted text = one turn, no speaker. (11)

## proposals

lead FK · transcript_id FK null · status proposal_status · spt_proposal_id unique · client_url · extracted_values jsonb · line_items jsonb · value numeric · sent_at, viewed_at, signed_at · error · usage. (12)

## proposal_revisions

proposal_id FK cascade · revision int, unique(proposal_id, revision) · prompt text · diff jsonb · applied_by FK profiles · usage. (12)

## invoices

proposal_id FK restrict · kind invoice_kind, unique(proposal_id, kind) · status · invoice_ninja_id unique · amount numeric · line_items jsonb · due_on, starts_on date · note · error · approved_by FK profiles (restrict) · events jsonb. (13)

## notifications

profile_id FK cascade, index (profile_id, created_at desc) · type notification_type · lead_id FK null · body text · href text · read_at. (15)

## ghl_sync_log

lead_id FK set null, index · write_type · idempotency_key unique · payload jsonb · result write_result default 'pending' · response jsonb (auth redacted) · attempts int · last_error. (01§4.3, 06)

## integration_connections (PK = provider)

provider PK · config jsonb (non-secret only) · last_success_at, last_error_at, last_error. Status derived. (01§4.5, 15)

## app_settings (PK = key)

key text PK · value jsonb. Seeds: `proposal_tweak_presets`, `booking_embed`, `transcript_retention_months` = 12 (assumed). (PD7)

## Open questions (each defaults as drafted until the spec that needs it)

1. Webhook events have no table (06 sync log second tab, 11, 13). Recommended: `webhook_events` added in spec 06's migration.
2. Bookings: two booking slots on `leads`; history would need a bookings table (06, 11 vs PD7).
3. `ghl_opportunity_id` nullable: a contact can arrive before its opportunity (06 Q8).
4. Form answers: which GHL fields carry them (08, 06 Q6)? Stored as jsonb for now.
5. "The rep's notes" (09, 12) have no home yet.
6. Assignment owner: GHL's assigned user vs the app's `assigned_to` on reconcile (06 Q5, 07)?
7. Statuses a rep may set by hand (07 Q2, 14 Q2): admins only until Lee answers.
8. Thresholds: `status_defs` (14) or `app_settings` (PD7)?
9. Share-link opens are "logged" (09) but nothing stores them.
10. Deck revisions: a number and Storage paths, no revisions table (09).
11. KPI rollup (07): computed live; drop the nightly rollup?
12. Integrations "error count 24h": derivable for GHL only.
13. Validation cost: a run is inserted once complete, never updated (08 vs 01§4.4).
14. Share token stored in plain text so it can be shown again (09).
15. Spam removal: the app archives its copy, never hard-deletes (06 W1, W4).
16. Proposal "lost" in the enum; when it applies is open (12 Q2).
17. ADR-0008 fallback: an `auth_user_id` column only if Supabase doesn't link the Google identity.
18. One currency (USD), no currency column (13).
