---
title: Validation and the suspect review queue
status: blocked
sessions: S8
registry: suspect-review-queue, validation-log
waiting_on:
  - The Typeform historical export (Bien owns it; needs Typeform access)
  - Spec 06 (contact created event, W1 and W4)
---

# 08. Validation and the suspect review queue

**Purpose:** give every new lead a verdict (Valid, Suspect, Spam) within minutes of the form, so GHL releases genuine leads into their sequence, removes spam, and holds suspects for a rep. It serves reps, and the funnel's speed.

## Validation job

Started by "contact created" (spec 06). Steps, as one Inngest function:

1. **Rules first.** Patterns that are spam on sight (vendors selling to us, job seekers, test submissions, disposable email domains) give Spam without a model call. The rules are derived from the Typeform export and live in one file with a comment per rule.
2. **Model verdict.** One OpenRouter call with the form answers, the website and the research brief (spec 07). Output, validated with zod: verdict, confidence, the patterns matched, reasons (short, one per line), summary.
3. **Record** a `validation_runs` row (inputs, output, model, tokens, cost) and set the lead's verdict.
4. **Write** W1 to GHL (spec 06). Valid: GHL releases the lead. Spam: GHL cancels the booking, sends the note and removes the record. Suspect: GHL waits.
5. **Notify** on Suspect (spec 15, "suspect to review").

A failure at step 2 retries; after the retries the lead becomes Suspect with the reason "The AI could not check this lead", so a person decides rather than the lead sitting held in GHL.

## Review queue (`/review-queue`)

The current suspect-review mockup, moved to the registry route, on real data:

- Oldest first; each item shows what the lead said, the AI's reasons and summary, and the booking if one exists ("It stays booked until you decide": GHL holds it).
- **Clear as valid** → verdict Valid, W1 with Valid; the funnel resumes.
- **Mark as spam** → W4; GHL removes the lead.
- Each decision appends a `validation_runs` row with the human override and who made it; that is the feedback loop for the rules and the prompt.
- After a decision, focus moves to the next item. A decision someone else already made returns "already decided" and refreshes the queue.

## Validation log (`/admin/validation-log`)

Admin only, read-only: every run with inputs, verdict, reasons, model, cost (null while pending, never 0), and any human override. Filters by verdict, overridden or not, and date.

## Acceptance checks

1. A form submission on the dev location produces a verdict and the matching W1 within five minutes.
2. Rule hits produce Spam with no model call and cost recorded as none.
3. Running the classifier over the Typeform export reports precision and recall per verdict; Bien shares the numbers with Mitchell before the queue goes live.
4. Clearing a suspect writes Valid to GHL once; marking spam writes Spam once; both appear in the sync log and the validation log.
5. A model outage turns new leads into Suspects with the stated reason, never leaves them without a verdict.

## Open questions

1. **Thresholds.** Which confidence turns a Valid into a Suspect? Set from the export results, then confirmed by Mitchell.
2. **Typeform access.** Who grants it for the export?
