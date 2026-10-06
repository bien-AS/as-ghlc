---
title: Decks and the deck presenter
status: blocked
blocked_by:
  - question 2
  - Presenton templates from Zach
owner_to_ask:
  - Zach
build_now: false
---

# 13. Decks and the deck presenter

**Purpose:** generate a branded deck for every valid lead, and let the rep present it on the call, edit its text and send it as a PDF. It serves reps.

> **Blocked.** This spec stops at the interface. It cannot go further until the items under "What is missing" arrive.

## What is missing, and from whom

| Missing                                                                                                                                                              | From | Why it blocks                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| **Question 2, part 1: where Presenton is hosted.** It runs self-hosted in Docker and cannot run on Vercel with the app, so it needs its own host. No assumed answer. | Zach | Nothing can be generated or shown until it runs somewhere the app can reach.  |
| **Question 2, part 2: whose editor reps use.** Presenton's embedded editor, or a lighter text editor that we build over the HTML. No assumed answer.                 | Zach | Decides what the deck presenter screen is.                                    |
| **Question 2, part 3: whether a CRM calendar can be embedded on the last slide.** Untested.                                                                          | Zach | The Proposal Review Booked stage depends on the lead booking from that slide. |
| **The deck templates.**                                                                                                                                              | Zach | Custom templates are HTML and Tailwind and have not been supplied.            |

## What is known

- Presenton builds the decks, not Atomic Slides. Settled on 5 October.
- Decks generate on their own for valid leads. There is no "generate" button.
- Presenton is open source (Apache 2.0) and has its own API, editor and templates.
- Its generate endpoint is `POST /api/v1/ppt/presentation/generate`, taking content, a template, a slide count and an export format of pptx or pdf. It returns a presentation ID, a file path and a link to Presenton's own editor.
- It supports Anthropic as its model provider. Auth is a bearer API key per Presenton user.
- Deck content is written by the AI. Decks is the only block that calls Presenton.
- There are at least two templates by purpose: discovery and review.

## Interface

**Started by:** a valid verdict on a lead (spec 10), including a suspect cleared by a rep (spec 07). Later, by the rep's edits.

**Takes in:** the lead (form answers, website, the verdict's research), a template, and the booking calendar link from the CRM adapter's lookups (spec 11).

**Produces:** a Deck for the lead: template, the deck service's presentation ID, a view link and a PDF link. These are the Deck fields in the data model sketch (assumed, spec 09).

**Hands on to:** the CRM adapter, to write the deck link to the contact; the lead's timeline, as an activity.

**Deck presenter screen**, per the handoff's page list: shows the deck full screen with the booking calendar on the last slide; actions are edit text, switch template, download PDF.

**Consumed today by:** Lead detail (spec 06), which shows a deck's presence, template and links from sample data and offers Open deck.

Nothing past this line is specified: not generation timing or retries, slide content, the editing model, how edits are saved, template switching, the PDF export path, or the presenter's layout and controls.

## In the current build

The deck presenter is a placeholder at `/dashboard/deck-presenter` (spec 04). Lead detail's Open deck action leads to it. No deck is generated.

## When unblocked

Once question 2 is answered and the templates arrive, this file is rewritten as a full spec. The handoff's work order places it ninth.
