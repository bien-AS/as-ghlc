---
title: Decks on Presenton
status: needs-clarification
sessions: S9, S10
registry: deck-generate, deck-detail, deck-edit, deck-library, first-value-celebration
research: docs/research/presenton-on-render.md (Presenton v0.9.11-beta, main at 4e9d853, read 19 October 2026)
waiting_on:
  - Bien: Presenton deployed on Render (setup below), its admin account and an API key
  - Mitchell, Zachery: the enhanced templates as branded PPTX files (AS placeholders unblock S9)
  - Lee: the GHL booking calendar embed code and its booking URL, for the deck's last slide
  - Zachery: questions 1 and 2 below
---

# 09. Decks on Presenton

**Purpose:** one click turns a lead and its research into a branded deck the rep presents on the call, edits beforehand if needed, shares, and exports to PDF, with the booking calendar on the last slide so the lead can book the proposal review on the spot. It serves reps; the M1 demo ends on a presented deck.

Presenton is self-hosted on Render. Facts about it below are from `docs/research/presenton-on-render.md`, which cites the code. Every Presenton release so far is a beta and its docs disagree with its code in places, so each upgrade is re-tested against the acceptance checks.

## Two findings that change the packet

1. **A live calendar cannot go inside a Presenton slide.** Presenton's template elements are text, image, chart, table and similar; there is no iframe, embed, HTML or even hyperlink element. So the app adds the booking slide itself: when a deck is presented in the app (`/decks/[id]`), the last slide is the app's own, carrying Lee's GHL calendar embed live. In the PDF and the Presenton file, the last slide shows a QR code and the printed booking URL instead.
2. **Presenton's editor cannot be embedded in the app.** Its iframe embed exists only in Presenton's paid cloud, and its session cookie blocks a cross-site frame. So reps edit in the app, through Presenton's edit endpoints, which is what the registry's `deck-edit` already describes (structured edits and prompt-driven slide regeneration). Reps never get Presenton accounts.

## Running Presenton (Bien)

- **Render Web Service** built from a small Dockerfile in this repo (`deploy/presenton/Dockerfile`): `FROM ghcr.io/presenton/presenton:v0.9.11-beta` pinned by digest, with our three templates copied into `/app/templates/<group>/`. Presenton loads that folder on every start, so templates live in Git as the packet requires and ship by deploy.
- **A 20 GB persistent disk at `/app_data`**: it holds Presenton's SQLite database, exports, images, fonts and its config (which includes provider keys). Without it, every deploy loses everything.
- **Plan `2c-8g`** (about $135 a month); `2c-4g` (about $85) is the floor. Presenton runs nginx, Next.js, FastAPI and headless Chromium for export in one container; its own load test peaked near 12 GB at four decks at once, so the app generates **one deck at a time** (an Inngest concurrency limit of 1).
- **Model:** `LLM=openrouter` with `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` set to a Claude model, and OpenRouter's zero-retention switch on. The model is one setting for the whole instance, not per request.
- **Auth:** set `AUTH_USERNAME` and `AUTH_PASSWORD` **before the first boot**: until a user exists, Presenton's setup endpoint lets whoever calls it first become admin. Never set `DISABLE_AUTH`. The app calls Presenton with a `sk-presenton-…` key created from the admin's browser session; keys expire in 1 to 365 days, so the key's expiry goes on the admin integrations card (spec 15) and in the team calendar. Render's IP allowlists need its $499 Scale plan, so access control is Presenton's keys on a custom HTTPS domain.
- **Exposure:** `/app_data/templates/` and `/app_data/fonts/` are served without auth. Nothing confidential goes in a template.
- **Fonts:** the image ships only Noto fonts. Poppins (the AS face) is uploaded to the instance, and the export is checked for substitution.
- Environment in the app: `PRESENTON_URL`, `PRESENTON_API_KEY`. One module, `src/lib/services/presenton.ts`, holds every call.

## Templates

Three groups, exactly: **Discovery Call**, **Follow Up**, **Strategy Session**. Presenton's current format is "Template V2": a `template.json` of layouts built from typed elements on a 1280 by 720 canvas, normally created by uploading a branded PPTX into a running instance. The README's "HTML and Tailwind" description is out of date.

Workflow: Mitchell and Zachery's enhanced decks arrive as branded PPTX files; Bien builds each template once in a local Presenton instance, exports its JSON with Presenton's conversion script, and commits it under `deploy/presenton/templates/<group>/`. AS-styled placeholders go in first so S9 never waits.

## Generate (`/leads/[id]/decks/new`)

- The rep picks the group, sees what goes in (the lead's form answers, research brief, verdict summary, and the rep's notes) and a cost line, and confirms.
- A `decks` row is created at once with status "generating"; the page goes to `/decks/[id]`, which shows progress.
- An Inngest job calls `POST /api/v1/ppt/presentation/generate/async` with the content, the group's template, `n_slides`, `tone: sales_pitch` and `export_as: pdf`, then polls `GET /api/v1/ppt/presentation/status/{task_id}` until completed or error. Presenton's webhook endpoint exists but never fires, so polling is the only way. Async jobs run inside Presenton's web process and a deploy loses them, so the job has a timeout and retries from the start.
- On completion the app stores the presentation id, copies the PDF and the slide JSON into Supabase Storage, and marks the deck ready. On error, the deck shows the error with "Try again".
- The first deck a person generates shows the one-time celebration (`first-value-celebration`), then sets `celebration_shown`.

## Deck detail (`/decks/[id]`)

- Slides drawn by the app from the stored slide JSON, with Present (full screen), slide navigation in the address, Download PDF, and Share.
- **The booking slide** is appended as the last slide in the app's presenter: Lee's GHL calendar embed, live, so the lead books the proposal review there. The rail shows whether the embed is configured.
- **Share:** a share token gives a read-only public link to the deck (slides plus the booking slide), which can be rotated; each open is logged.
- W2 (deck link to GHL) is built behind its flag and off (spec 06).

## Deck edit (`/decks/[id]/edit`) and library (`/decks`)

- Edit each slide's text fields in a structured form, or ask for one slide to be regenerated with an instruction. Saving calls Presenton's `POST /edit` (or `PATCH /slide_update`) and re-exports the PDF; each save is a revision. Full WYSIWYG is out of scope.
- The library lists every deck the person may see, filtered by group and status. Creation always starts from a lead.

## Acceptance checks

1. A deck generates for a lead in each of the three groups, on the Render instance, in under five minutes, and appears ready on `/decks/[id]`.
2. Two decks requested together run one after the other; neither fails.
3. A Presenton restart during generation ends in a retried, successful deck or a clear error, never a deck stuck "generating".
4. Presenting a deck ends on the live booking slide; booking a slot there creates the booking in GHL (checked with Lee).
5. The PDF has every slide plus a final slide with the QR code and booking URL, in Poppins.
6. Editing a slide's text and regenerating a slide each produce a new revision and a matching PDF.
7. A share link shows the deck to someone signed out, read-only; rotating it kills the old link.
8. A rep cannot open another rep's deck by id or share token management.
9. The Presenton key and admin password are in no response the app sends.

## Open questions

1. **Booking slide:** is the app-appended live slide, with a QR code and URL in the PDF, acceptable? (Zachery, Lee)
2. **The export package's licence.** Presenton is Apache-2.0, but its export renderer ships as a prebuilt tarball from a repository with no licence file. Check before relying on it commercially. (Zachery)
3. Do hyperlinks survive PDF export? (Bien, on the deployed instance)
4. Cold start and peak memory on `2c-4g` versus `2c-8g`. (Bien, on the deployed instance)
5. Keep Presenton's SQLite on its disk, or point it at Postgres? Assumed: SQLite on the disk; the app keeps its own copy of every deck.
6. Which OpenRouter model id for Claude, and its cost per deck. (Bien, then Zachery)
