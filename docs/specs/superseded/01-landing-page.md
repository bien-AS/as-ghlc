---
title: Landing page
status: ready
blocked_by: []
owner_to_ask:
  - Project lead
build_now: true
---

# 01. Landing page

**Purpose:** tell a visitor what Dealwright does and get them to sign up or sign in. It serves anyone who arrives at `/` without an account, and returning users looking for the way in.

The public name is **Dealwright**, shown as **Dealwright by Authority Solutions** while the product is early. ASCRM is the internal name only and never appears on the page.

> **Open (does not block the build):**
>
> - **Describing capabilities that are not built.** Decks, proposals and invoices are blocked specs. The owner's copy describes them as what the product does. Assumed: where the page goes into detail on one of them (sections 5, 6 and 7), it carries a visible "Planned" label, and nowhere does the page say they are available now. Owner: Project lead.
> - **A logo for dark surfaces.** Resolved: the owner supplied an all-white version, `public/as-logo-white.png`. It is used on dark surfaces; see "Logo and wordmark".
> - **A Dealwright logo.** None exists. Assumed: Dealwright is set as a text wordmark in the heading font.
> - **Privacy policy and terms.** Sign-up is open (ADR-0004) and collects names and emails, but no legal pages exist. The footer must not link to pages that do not exist. Owner: Project lead.
> - **Palette and fonts** are provisional (question 12). See spec 03.

## Problem Statement

A visitor who lands on the site today sees a framework starter page. They cannot tell what the product is, whether it is for them, or how to get in. A returning user has no visible route to sign in.

## Solution

A single public marketing page at `/`. It explains the product in the order a rep would experience it (a lead arrives, the AI vets it, the rep works it to a signed proposal), shows the real shape of the product instead of borrowed credibility, and offers two calls to action throughout: **Sign up** (primary) and **Sign in**.

The page's structure and motion follow a reference marketing site (Trajectory): a slim nav, a tall illustrated hero, a sticky numbered narrative, a feature switcher, a control list, a dark band, a statistic card, a closing call to action and a footer over a giant wordmark. Colour and type come from the design tokens (spec 03), not from the reference's pastel palette.

### Positioning

Carried through every section: **Dealwright is not a CRM replacement. It works on top of the CRM the customer already uses.** The page never asks a visitor to migrate, and never names any particular CRM.

### Content rule

Everything on the page must be true. No invented customers, testimonials, logos, funding, user counts or performance metrics. No claim that a capability is "live", "available now" or in use by anyone. Where the reference uses a section that depends on such material, this spec replaces it with an honest equivalent or drops it, and says which. The page names no third-party service by brand; it speaks of kinds of service ("your CRM", "proposals", "invoicing").

### Hero copy (owner's)

- **Headline:** "From new lead to signed proposal, in one place."
- **Sub-headline:** "Dealwright sits on top of the CRM you already use, vets each inbound lead with AI, builds the deck and proposal, and drafts the invoice the moment it is signed." It may be tightened; it must stay true and must not add "now", "today" or similar.

### Logo and wordmark

- **Dealwright** is a text wordmark set in the heading font (assumed; no Dealwright logo exists).
- **The Authority Solutions logo** (`public/as-logo.png`, 680 by 173 pixels, a wide horizontal lockup of a red shield and a near-black wordmark on a transparent background) is the endorsing company's logo, not a Dealwright logo. It is used only for the "by Authority Solutions" endorsement, in the nav and the footer.
- Rules for the logo: keep its aspect ratio (about 3.93 to 1); never stretch, crop, recolour or redraw it; size it by height; keep clear space around it of at least the height of the shield on every side; do not modify or move the file.
- **Dark surfaces.** The near-black file is for light surfaces and the all-white file (`public/as-logo-white.png`, the same 680 by 173 pixels) is for dark ones. The theme picks the file; there is no plate behind the logo and no text fallback. The footer's endorsement follows the same rule. The logo does not appear in the band (section 7).

### Sections, top to bottom

| #   | Section        | Reference pattern                                                               | What the page shows                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Nav            | Slim bar, two CTAs                                                              | The Dealwright wordmark with the "by Authority Solutions" endorsement, linking to the top of the page. Anchor links to "How it works", "Features" and "Control". Two CTAs on the right: **Sign in** (default button) and **Sign up** (primary). Theme switch.                                                                                                                        |
| 2   | Hero           | Tall, illustrated, two-line headline, short sub-line, one CTA                   | The owner's headline on two lines and the sub-headline. One CTA: **Sign up**. The illustration is a stylised view of the product itself (a pipeline with lead rows and a verdict box), drawn with sample names, not a screenshot of data.                                                                                                                                            |
| 3   | Pipeline strip | "Social proof" logo row with a quote carousel                                   | **Replaced.** There are no customer logos or testimonials to show. In its place: a single row naming the six stages in order (New lead, Discovery Call Booked, Qualified, Proposal Review Booked, Proposal Sent, Lead Won) and the three exits (Spam, Nurture, Lead Lost). The quote carousel is dropped.                                                                            |
| 4   | How it works   | Sticky numbered narrative: heading and 3 steps left, large illustration right   | Heading plus three numbered steps: (1) a lead comes in from the CRM you already use; (2) AI researches it and returns a verdict of valid, suspect or spam; (3) the rep works the lead through the pipeline to a signed proposal. The right-hand panel shows one illustration per step and changes as the step in view changes.                                                       |
| 5   | Features       | Centred intro, then a four-item switcher; the active item expands with an image | Centred intro, then four items: **Pipeline** (every lead by stage, with a "needs you" strip), **Verdict** (the AI's summary and reasons on every lead), **Suspect review** (form answers beside the AI's reasons, two decisions), **One next step** (each lead shows one main action and a line saying why). The active item expands to show its illustration.                       |
| 6   | Control        | Three-point "you stay in control" list beside an illustration                   | Three points: the AI flags, a rep decides on every suspect; a rep, not the app, marks a lead qualified or not; nothing is sent to a lead without a rep reviewing it first (labelled "Planned" while proposals are unbuilt).                                                                                                                                                          |
| 7   | Works on top   | Dark band with heading and logo marquee                                         | Dark band whose heading states the positioning: not a replacement for your CRM; it works on top of it. The marquee carries text labels for the kinds of service the product connects to (CRM, AI research, decks, proposals, invoicing), each not-yet-built kind labelled "Planned". No third-party logos or brand names. The Authority Solutions logo does not appear in this band. |
| 8   | Product facts  | Large statistic card                                                            | **Replaced.** There are no usage or outcome metrics. The card shows structural facts that are true by design: 6 stages, 3 exits, 1 next step per lead. No percentages, no time-saved claims.                                                                                                                                                                                         |
| 9   | Articles       | Short list of linked articles                                                   | **Dropped.** No articles exist. Add the section when there is something to link to.                                                                                                                                                                                                                                                                                                  |
| 10  | Closing CTA    | Centred final CTA                                                               | Centred heading, one line, and both CTAs: **Sign up** (primary) and **Sign in**.                                                                                                                                                                                                                                                                                                     |
| 11  | Footer         | Link columns over a giant wordmark                                              | Two link columns: "Product" (anchors to sections 4, 5, 6) and "Account" (Sign in, Sign up, Reset password). The "by Authority Solutions" endorsement. A giant "Dealwright" text wordmark beneath. No links to legal, blog, careers or social pages, because none exist.                                                                                                              |

### Calls to action

Every **Sign up** goes to `/sign-up`. Every **Sign in** goes to `/sign-in`. The page itself does not read the session: a visitor who is already signed in and follows either CTA is redirected onward by the rules in spec 02.

### Motion intent

What should feel alive, and why. Exact animation design happens at build time through the design workflow in AGENTS.md, and every item below must have a reduced-motion equivalent that conveys the same content without movement.

| Section        | What should feel alive                                                          | Why                                                              |
| -------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Nav            | The bar settles into a compact state once the page scrolls.                     | Keeps the two CTAs in reach without covering content.            |
| Hero           | The illustration assembles once on load; a lead row receives its verdict.       | Shows the product's central idea in the first seconds.           |
| Pipeline strip | Stages light up in order, once, as the row enters view.                         | Conveys that the stages are a sequence.                          |
| How it works   | The left column stays put while steps advance; the panel changes with the step. | Ties each step to its picture so the story reads as one flow.    |
| Features       | The chosen item opens and the others close as one movement.                     | Makes clear that one item is active and the rest are a tap away. |
| Control        | Points arrive one after another.                                                | Lets three short claims be read one at a time.                   |
| Works on top   | The marquee drifts continuously and pauses on hover or focus.                   | Signals an open-ended set of connected services.                 |
| Product facts  | Numbers settle into place once.                                                 | Draws the eye to the only numeric content on the page.           |
| Closing CTA    | Still. Buttons respond to hover, focus and press.                               | The decision point should be calm.                               |
| Footer         | The wordmark is revealed as the page ends.                                      | A deliberate finish to the page.                                 |

### As built (revision notes)

Where the built page is more specific than, or differs from, the table above:

- **Nav.** The theme switch is in the nav from 720px up and in the footer below it, so only one is on screen and both CTAs fit at 375px. The bar's surface is opaque.
- **Hero.** From 1024px the copy and the picture share one grid: the second headline line, the sub-headline and Sign up start on the same column line; the list of leads fills the space to their left and the verdict sits in front of it, under the button. The picture and its one-time verdict are inside the first screenful at 1280 by 800. The stage tabs in the picture run past its edge and fade out, as the app's tab row scrolls sideways.
- **Pipeline strip.** From 1024px the six stages sit on one rail from edge to edge. A sample lead travels the rail once when it comes into view. A bracket under stages one to five leads to the three exits: a lead can leave before it is won (glossary, "Exit"). The page does not say which exit happens at which stage.
- **How it works.** The block pins from 1024px wide and 672px tall; each step holds for the same amount of scroll. Each picture plays one change of state when its step becomes current (the verdict resolves; the stage advances and the next-step line changes). Otherwise the steps are a list, each with its picture beside it on a wide screen and under it on a narrow one.
- **Features.** A row from 1280px, a stack below.
- **Works on top.** See "Themes" under States: the band is dark in the light theme and light in the dark theme.
- **Pictures.** Each is composed in two overlapping planes on a softly tinted ground, built from the app's own chips, labels and wording, with made-up names and a "Sample data" chip.

## States

- **Default:** the full page, static content, no data requests.
- **Loading:** none. The page renders complete from the server; illustrations and the logo must not shift layout as they load.
- **Empty:** not applicable. The page has no user data.
- **Error:** the page has no data dependencies, so its only failure is the app's general error page.
- **Signed-in visitor:** sees the same page. The CTAs still read Sign up and Sign in and redirect to `/dashboard` through spec 02's rules.
- **Reduced motion:** all content visible without animation; the marquee is static; the sticky narrative becomes three stacked steps each with its illustration.
- **Small screens:** single column below 720px. The sticky narrative and the feature switcher stack. Nav anchor links collapse; both CTAs stay visible.
- **Themes:** light and dark both work (spec 03). The band (section 7) is the page's one tonal break and reads the other theme's tokens: dark in the light theme, light in the dark theme, because a dark band on the dark ground barely separates. In the dark theme the white version of the Authority Solutions logo is shown.

## Data

None read or written. The page is static content and touches no entity in the data model.

## Assumptions

- Palette, fonts, radii and buttons follow the prototype's tokens, assumed pending **question 12**.
- Dealwright is set as a text wordmark because no Dealwright logo exists. Assumed.
- Detailed mentions of decks, proposals and invoicing carry a "Planned" label. Assumed; see Open note.
- The product is described as working on top of a customer's CRM. That product direction is assumed pending **questions 9 to 11** and has not yet been raised with Zach or Mitchell.
- Control point 1 ("a rep decides on every suspect") reflects the assumed answer to **question 4**.
- "Drafts the invoice the moment it is signed" in the sub-headline reflects the assumed answer to **question 3** (draft only).

## Acceptance checks

1. Visiting `/` signed out shows sections 1, 2, 3, 4, 5, 6, 7, 8, 10 and 11 in that order, and no articles section.
2. The hero headline reads "From new lead to signed proposal, in one place."
3. Every Sign up control leads to `/sign-up` and every Sign in control leads to `/sign-in`.
4. The page says "Dealwright" and never "ASCRM".
5. The page text contains no customer name, testimonial, third-party logo, funding statement or performance metric, and does not contain "GoHighLevel" or any other third-party brand name. The only company named besides Dealwright is Authority Solutions, in the endorsement.
6. The page nowhere says a capability is live, available now or in use; decks, proposals and invoicing carry a visible "Planned" label in sections 5, 6 and 7.
7. The page states that the product works on top of the visitor's CRM and does not replace it.
8. The pipeline strip lists exactly the six stages in order and the three exits, spelled as in the glossary.
9. The Authority Solutions logo keeps its proportions at every width (width divided by height stays about 3.93), is not cropped, and has clear space around it.
10. In the dark theme the white version of the logo is shown; the near-black one is never shown on a dark background. The logo is absent from the band.
11. With the operating system set to reduce motion, nothing on the page animates and all content is still readable.
12. At 375px wide there is no horizontal scroll and both CTAs are reachable without opening a menu.
13. The page renders correctly in light and dark themes, and the theme switch works.
14. The whole page can be used with a keyboard: every link, button and feature item is reachable and shows a focus ring, and the feature switcher announces which item is expanded.
15. The product name appears from one source, so a rename is one change.
16. The footer contains no link that leads to a missing page.

## User Stories

1. As a visitor, I want to understand in one headline what Dealwright is, so that I can decide whether to keep reading.
2. As a visitor, I want to know at once that it works on top of my CRM, so that I do not assume I must migrate.
3. As a visitor, I want a sign-up button in the first screen, so that I can start without scrolling.
4. As a returning user, I want a sign-in button in the nav at all times, so that I can get to my dashboard quickly.
5. As a visitor, I want to see who is behind the product, so that I can judge whether to trust it.
6. As a visitor, I want to see the stages a lead moves through, so that I understand the product's shape.
7. As a visitor, I want the three steps of how it works explained with a picture each, so that I can follow the flow without reading a manual.
8. As a visitor, I want to explore the main features one at a time, so that I am not faced with a wall of text.
9. As a visitor, I want to know what the AI decides and what a person decides, so that I can trust the product with real leads.
10. As a visitor, I want planned features labelled as planned, so that I am not misled about what works today.
11. As a visitor, I want only true claims on the page, so that I can rely on what it says.
12. As a visitor who prefers reduced motion, I want the page to hold still, so that I can read it comfortably.
13. As a visitor on a phone, I want the page to read well in one column, so that I can sign up from any device.
14. As a visitor using a keyboard or screen reader, I want every control reachable and named, so that I can use the page.
15. As a visitor who prefers dark mode, I want the page to follow my device and let me switch, so that it is comfortable to read.
16. As a visitor in dark mode, I want the endorsing logo to stay legible, so that it does not look broken.
17. As a visitor at the end of the page, I want a final call to action, so that I do not have to scroll back up.
18. As a signed-in user who lands on `/`, I want the CTAs to take me to my dashboard, so that I am not asked to sign in again.
19. As Authority Solutions, I want our logo shown undistorted and with space around it, so that our brand is respected.
20. As the project lead, I want the product name defined once, so that a rename is trivial.
21. As the project lead, I want sections that depend on material we do not have left out, so that the page never fakes credibility.

## Implementation Decisions

- The page is public, static and rendered on the server. It reads no session and makes no data requests, so it needs no TanStack Query hooks (ADR-0001 allows static content to be rendered directly).
- The page is bespoke. It does not use the component library's look; it borrows an accessible primitive from it only where one is needed (for example the feature switcher's disclosure behaviour). See spec 03.
- Each numbered section is its own component; the page composes them in order. Interactive sections (nav scroll state, sticky narrative, feature switcher, marquee) are the only client components. The nav and footer are reusable components, since the auth pages share the wordmark and endorsement.
- All colour, type, radius and button styling comes from the tokens in spec 03. No colour or font from the reference site is used.
- The wordmark-with-endorsement is one component with the logo rules built in: height-based sizing, fixed aspect ratio, clear space, and the dark-surface behaviour. It is used by the landing nav and footer and by the auth pages.
- The logo is rendered through the framework's image facility with its intrinsic dimensions declared, so it never shifts layout or distorts.
- Illustrations are drawn for Dealwright using the token palette and sample names. They are not screenshots and contain no real person's data.
- The feature switcher is an accessible disclosure set: one item open at a time, operable by keyboard, state exposed to assistive technology.
- The marquee is decorative repetition of a list that is also present once as plain text for assistive technology.
- Motion is designed and built at build time following the design workflow in AGENTS.md. Every animation respects the reduced-motion setting.
- The product name is a single constant used by the nav, footer, wordmark and page metadata.
- Page metadata (title, description) replaces the framework starter defaults and uses Dealwright.
- The starter page content at `/` is removed.

## Testing Decisions

_Seams confirmed by the owner: pages through Testing Library at page level; no end-to-end browser suite yet. This page has no data-access functions or Route Handlers._

- A good test checks what a visitor can see and do, not how sections are built.
- Seam: the page rendered through Testing Library. Checks: the headline; both CTAs point to `/sign-up` and `/sign-in`; the six stages and three exits are present; "ASCRM" and third-party brand names are absent; planned capabilities carry the "Planned" label; the endorsement is present; the feature switcher exposes its expanded state.
- Motion, sticky behaviour, logo legibility on dark surfaces and layout are verified by eye during design review, not by automated tests.
- Prior art: none in the repo; these are the first page tests.

## Out of Scope

- Pricing, paywall or plan selection.
- Blog, articles, changelog, documentation, careers, legal pages.
- Customer logos, testimonials, case studies, metrics.
- Analytics, cookie banners, A/B tests, contact or demo-request forms.
- Search-engine and social-preview work beyond a title and description.
- A Dealwright logo.
- Translations.

## Further Notes

- The reference site is a guide to rhythm and motion only. Its copy, illustrations, palette and fonts are not reused.
- If the answer to question 12 changes the design system, this page changes with spec 03 and needs no structural rework.
- The handoff says to use "ASCRM" for the product. The owner's later decision makes Dealwright the public name and keeps ASCRM as the internal one.
