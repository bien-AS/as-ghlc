---
title: UI foundations
status: ready
blocked_by: []
owner_to_ask:
  - Zach
build_now: true
---

# 03. UI foundations

**Purpose:** give every screen one set of colours, type, shapes and base components in a light and a dark theme. It serves the people building screens, and through them every user.

> **Flagged for question 12.** The palette, fonts and shapes below are copied from the prototype and are **assumed**. Zach named the ASVantage design system as the styling source and has not confirmed which applies. Build to this spec, and keep every value behind a named token so the answer to question 12 is a change of values, not of screens.

## Problem Statement

The app has a framework starter stylesheet and no shared components. Without foundations, each screen would choose its own colours and spacing, the two themes would drift apart, and a change of design system (question 12) would mean editing every screen.

## Solution

A token set with a light and a dark value for each token, three font roles, a small set of shapes, and the base components the first screens need: button, chip, panel, form field, verdict box, hint line, list row, tabs, skeleton, empty state, error state, placeholder panel and theme switch. Screens use tokens and components only; no screen contains a raw colour.

### Colour tokens

| Token      | Light   | Dark    | Used for                               |
| ---------- | ------- | ------- | -------------------------------------- |
| ground     | #F7F4F2 | #2B2827 | Page background                        |
| surface    | #FFFFFF | #353130 | Panels and cards                       |
| surface-2  | #EFEAE7 | #403B39 | Hover, selected row, secondary buttons |
| line       | #DFD7D3 | #524C49 | Borders and dividers                   |
| ink        | #1E1A18 | #FFFFFF | Main text                              |
| ink-2      | #5F5651 | #D2CAC5 | Secondary text                         |
| ink-3      | #8B8079 | #A69D97 | Labels and hints                       |
| brand      | #A52B30 | #C93A3F | Primary buttons, selected-row marker   |
| brand-ink  | #FFFFFF | #FFFFFF | Text on brand                          |
| brand-text | #A52B30 | #F58A84 | Links and red text on a background     |
| brand-soft | #F8E7E7 | #4D2527 | Tinted chips, avatars                  |
| ok         | #2B6E4E | #86D1A8 | Valid, qualified                       |
| ok-soft    | #DCEEE4 | #25402F | Background behind ok                   |
| warn       | #8A6210 | #E3B866 | Waiting, held                          |
| warn-soft  | #F6EBD2 | #453817 | Background behind warn                 |
| crit       | #AC3229 | #F4978B | Suspect, spam, removed                 |
| crit-soft  | #F7DFDB | #50282A | Background behind crit                 |

The light theme is the prototype's. The dark theme is new: a warm mid-grey ground with white text and red.

### Contrast rules

- `brand` is for fills only. On the dark ground it reaches 2.9 to 1, too low for text. Red text and links use `brand-text`.
- `ink-3` on the light ground is 3.5 to 1, below the 4.5 needed for body text. Use it only for labels of 14px bold or larger, or darken it. It is never used for body copy or for the only statement of a fact.
- Status colours (`ok`, `warn`, `crit`) are used as text on their own `-soft` background or on `ground` and `surface`. Every such pair in the dark theme is above 5.7 to 1.
- Reference ratios in dark: white on ground 14.6 to 1; white on brand 5.1 to 1; brand-text on ground 6.2 to 1.
- Colour never carries meaning alone: a verdict or status always has its word beside the colour.

### Type

| Role    | Font                | Weights     | Use                                                                                            |
| ------- | ------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| Heading | Bricolage Grotesque | 600 and 700 | Page and panel titles, lead names, landing headlines                                           |
| Body    | Source Sans 3       | 400 and 600 | All running text and controls. 15px, line height 1.5                                           |
| Label   | IBM Plex Mono       | 400 and 500 | Panel headings and field labels. 10.5 to 12px, uppercase with wide tracking for panel headings |

### Shape and layout

| Thing   | Value                                                                                      |
| ------- | ------------------------------------------------------------------------------------------ |
| Radius  | 13px panels; 11px verdict and deck boxes; 9px buttons and inputs; full pill for chips      |
| Width   | Content max width 1280px                                                                   |
| Columns | Three columns of 270px, flexible, 300px. Two columns below 1080px. One column below 720px. |

### Components

| Component         | Behaviour                                                                                                                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button            | Three kinds. **Primary:** brand fill, brand-ink text. **Default:** surface-2 fill with a line border. **Danger:** crit outline, no fill. **Disabled:** 40% opacity and not focusable by pointer. A loading state shows progress and blocks a second press. A button can also render as a link. |
| Chip              | Full-pill label. Tones: neutral, brand, ok, warn, crit; each uses the tone's text colour on its `-soft` background. Used for stage, status, verdict, owner and "Planned" or "Sample data" labels.                                                                                              |
| Panel             | Surface background, line border, 13px radius, optional label-font heading.                                                                                                                                                                                                                     |
| Form field        | Label, input, optional hint, error message tied to the input for assistive technology. Text, email and password inputs; a select; a search input.                                                                                                                                              |
| Verdict box       | 11px radius box toned by verdict: ok for valid, warn for awaiting, crit for suspect and spam. Shows the verdict word, the summary and the list of reasons.                                                                                                                                     |
| Hint line         | One line under a lead's actions saying what to do next and why. Secondary text.                                                                                                                                                                                                                |
| List row          | A row in a list or table. Hover uses surface-2. The selected row has a brand left edge. A removed lead's name is struck through.                                                                                                                                                               |
| Tabs              | A row of labelled tabs, each with an optional count. Keyboard-operable.                                                                                                                                                                                                                        |
| Skeleton          | A placeholder block shaped like the content it stands in for, used while loading.                                                                                                                                                                                                              |
| Empty state       | A panel with a short heading, one sentence and an optional action.                                                                                                                                                                                                                             |
| Error state       | A panel with what failed in plain words and a "Try again" action.                                                                                                                                                                                                                              |
| Wordmark          | The Dealwright text wordmark, optionally with the "by Authority Solutions" endorsement. Carries the logo rules below so no screen can break them.                                                                                                                                              |
| Sidebar, navbar   | The dashboard's two shell components (spec 04).                                                                                                                                                                                                                                                |
| Dialog, sheet     | A modal dialog for confirmations; a sheet for the navigation on small screens. Focus is trapped, Escape closes, focus returns to the opener.                                                                                                                                                   |
| Dropdown menu     | For the user menu and filter controls.                                                                                                                                                                                                                                                         |
| Tooltip           | For truncated text and icon-only controls.                                                                                                                                                                                                                                                     |
| Table             | For dense lists such as the Pipeline.                                                                                                                                                                                                                                                          |
| Toast             | A brief confirmation or failure message after an action.                                                                                                                                                                                                                                       |
| Placeholder panel | For a screen not built yet: the screen's name, one sentence on what it will do, and a "Waiting on" list. Convention defined in spec 04.                                                                                                                                                        |
| Theme switch      | A control offering System, Light and Dark.                                                                                                                                                                                                                                                     |

### Logo and wordmark

- The product's public name is Dealwright, shown as "Dealwright by Authority Solutions" while the product is early. **Dealwright is a text wordmark set in the heading font.** No Dealwright logo exists (assumed until one is supplied).
- **The Authority Solutions logo** (`public/as-logo.png`) is the endorsing company's logo, not a Dealwright logo. It is 680 by 173 pixels (about 3.93 to 1), a wide horizontal lockup with a red shield on the left and a near-black wordmark, on a transparent background. It is used only for the "by Authority Solutions" endorsement: the landing nav and footer, and the auth pages.
- Preserve its aspect ratio. Never stretch, crop, recolour or redraw it. Size it by height. Keep clear space on every side of at least the height of the shield. Do not modify or move the file.
- **Dark surfaces.** The near-black wordmark is legible only on light surfaces. In the dark theme, and on any dark section, either place the logo on a light surface or do not show it there and write "by Authority Solutions" as text. **No light or inverted version exists; one would have to be supplied by the owner.**

### Reusable components

Owner's rule: always look for opportunities to extract reusable components (sidebars, navbars and the like) into `src/components/ui` rather than leaving them inline in a page. A piece of interface used, or likely to be used, by more than one screen is a component there; pages compose components and hold no markup of their own that another page would need.

### Theme rule

Follow the device setting by default. The switch lets a person choose Light or Dark instead, or return to System. The choice is remembered in that browser. The page must not flash the wrong theme while loading.

## States

- **Component states:** every interactive component has default, hover, focus-visible, pressed and disabled states, and a loading state where it triggers work. Focus is always visible in both themes.
- **Loading:** screens use skeletons shaped like their content, not spinners over blank space.
- **Empty:** the empty-state component.
- **Error:** the error-state component with retry.
- **Theme:** System (default), Light, Dark. If the stored choice cannot be read, fall back to System.
- **Reduced motion:** component transitions are removed or reduced to an instant change.
- **Fonts not loaded yet:** text is shown in a fallback font without layout shift large enough to move controls.

## Data

None. No entity in the data model is read or written. The theme choice is stored in the browser only.

## Assumptions

- **Question 12:** the prototype's palette, fonts, radii, layout widths and button styles are the design system. Assumed.
- The dark theme values are new and were proposed in the handoff; they are part of the same assumption.
- The theme choice is per browser, not per user account. Proposed.
- A three-way switch (System, Light, Dark) satisfies "follow the device by default and add a manual switch". Proposed.
- Dealwright is a text wordmark because no Dealwright logo exists. Assumed.
- shadcn/ui as the component library is recommended by the lead and awaits owner confirmation.

## Acceptance checks

1. Every token in the table exists with both values, and switching theme changes every surface, text and status colour on a page.
2. A search of the screens finds no raw colour value outside the token definitions.
3. With the switch on System, changing the device's setting changes the app's theme without a reload.
4. Choosing Dark, reloading and reopening the browser keeps Dark, with no flash of the light theme.
5. In the dark theme, no text is set in `brand`; red text uses `brand-text`.
6. In the light theme, `ink-3` appears only on labels of 14px bold or larger.
7. Every text and background pair in use meets 4.5 to 1, or 3 to 1 for text of 18.66px bold or 24px and larger.
8. Primary, default, danger and disabled buttons match the definitions; a disabled button is at 40% opacity and does nothing.
9. Every interactive component can be reached and operated by keyboard and shows a visible focus ring in both themes.
10. Each verdict and status is readable with colour removed (greyscale check).
11. At 1280px and wider the content stops growing; the layout is two columns below 1080px and one below 720px.
12. Headings, body and labels use the three specified fonts at the specified sizes and weights.
13. Wherever the Authority Solutions logo appears, its width divided by its height is about 3.93, it is not cropped, and it has clear space around it.
14. In the dark theme the logo is on a light surface or absent, never near-black on a dark background.
15. No component on an app surface has the component library's default look: colours, radii and fonts all come from the tokens, in both themes.
16. The sidebar, navbar, wordmark, dialog and the other shared pieces exist once, as components, and are not repeated inline in pages.

## User Stories

1. As a rep, I want the app to follow my device's light or dark setting, so that it is comfortable without setup.
2. As a rep, I want to switch theme by hand, so that I can override my device when I need to.
3. As a rep, I want my theme choice remembered, so that I do not set it every visit.
4. As a rep, I want the primary action to look different from other buttons, so that I know what to press.
5. As a rep, I want destructive actions to look different, so that I do not press them by mistake.
6. As a rep, I want disabled buttons to look disabled, so that I do not wonder why nothing happens.
7. As a rep, I want verdicts colour-coded and named, so that I can scan a list and still be sure.
8. As a rep with low vision, I want text contrast that meets accessibility ratios, so that I can read every label.
9. As a colour-blind rep, I want meaning carried by words as well as colour, so that I do not misread a verdict.
10. As a keyboard user, I want a visible focus ring everywhere, so that I always know where I am.
11. As a rep on a small laptop, I want the layout to collapse sensibly, so that nothing is cut off.
12. As a rep, I want loading to show the shape of what is coming, so that the page does not jump.
13. As a rep, I want empty and error screens that say what happened and what to do, so that I am not left guessing.
14. As a rep who prefers reduced motion, I want transitions kept still, so that the app is comfortable.
15. As a developer, I want named tokens for every colour, so that I never pick a hex value.
16. As a developer, I want one button, chip, panel and field component, so that screens look the same without effort.
17. As a developer, I want a placeholder panel component, so that unbuilt screens are labelled consistently.
18. As the project lead, I want the palette isolated behind tokens, so that choosing ASVantage later is a change of values only.
19. As Authority Solutions, I want our logo never stretched, cropped or shown illegibly, so that our brand is respected.
20. As a user in dark mode, I want the endorsement to stay readable, so that nothing looks broken.
21. As a developer, I want shared interface pieces extracted into one place, so that I reuse them instead of copying markup.
22. As a developer, I want accessible primitives for menus, dialogs and tabs, so that I do not rebuild keyboard and focus handling.

## Implementation Decisions

- Tokens are defined once as theme variables in the global stylesheet and exposed to Tailwind, so utility classes refer to token names. The starter stylesheet's colours and fonts are replaced.
- Dark values apply when the device prefers dark and no manual choice is stored, or when the stored choice is Dark; light values apply otherwise. The stored choice is applied before first paint.
- The three fonts are loaded through the framework's font facility with only the listed weights, replacing the starter fonts.
- **Component library: shadcn/ui, for the app surfaces** (auth pages and dashboard). _Recommended by the lead, awaiting owner confirmation._ It is not part of the committed codebase yet. At the time of writing, the library's configuration, dependencies and a full set of its components are present in the working tree, uncommitted, still carrying the library's default theme and not yet passing the repository's format check. That is a starting point, not a finished install: the components still have to be re-themed and the unused ones removed. Its components are copied into `src/components/ui` and re-themed with the tokens above in both themes, so nothing ships with the default shadcn look. It supplies the accessible primitives: sidebar, dropdown menu, dialog and sheet, tooltip, tabs, form controls, table and toast. The landing page is bespoke and borrows a primitive only where it needs one.
- **Reusable components live in `src/components/ui`** (owner's rule, above). This is the one place in these specs where a directory is named, because the rule itself names it.
- **The wordmark component** renders the Dealwright text wordmark and, when asked, the endorsement with the Authority Solutions logo. It sizes the logo by height with its intrinsic ratio declared, applies the clear space, and on a dark surface either puts the logo on a light plate or falls back to text. Screens never place the logo file directly.
- Components are plain presentational components with no data access. They are the only place token-to-role decisions are made (for example "danger button uses crit").
- The verdict box and chip take a tone, and a single mapping turns a verdict or status into a tone, so every screen colours them the same way.
- The 14px-bold floor for `ink-3` is enforced by using it only inside the label styles.
- Building and reviewing these components follows the design workflow in AGENTS.md.
- Icons come from the icon library already installed.
- Components the library does not supply (chip tones, verdict box, hint line, placeholder panel, empty and error states, wordmark) are built directly on the tokens.

## Testing Decisions

_Seams confirmed by the owner: pages through Testing Library at page level; no end-to-end browser suite yet. This spec has no data-access functions or Route Handlers._

- A good test checks behaviour a user relies on: a button's disabled and loading states block action, a field's error is tied to its input, the theme switch changes and stores the theme.
- Components are exercised through the page-level tests of the screens that use them (specs 01, 02, 04 to 07), not by a separate suite per component. Primitives taken from the component library are not re-tested.
- The verdict-and-status-to-tone mapping is tested as a function: every verdict and every status in spec 05's list has a tone.
- Colour values, contrast and visual appearance are checked by eye and with a contrast checker during design review, not by automated tests.
- Prior art: none in the repo.

## Out of Scope

- Adopting ASVantage (waits on question 12).
- Per-workspace branding (the data model sketch gives Workspace a branding field; spec 09).
- Components not needed by specs 01, 02, 04, 05, 06 and 07, such as date pickers, rich text editors and data grids.
- An illustration or icon set of our own.
- A Dealwright logo, and a light version of the Authority Solutions logo (to be supplied by the owner).
- Motion design for specific screens (decided per screen at build time).
- Print styles and translations.

## Further Notes

- The prototype had no theme switch, which is why its theme could not be changed by hand. The switch is a required change from the prototype.
- The handoff notes that the light `ink-3` value could be darkened instead of restricted. This spec restricts its use and leaves the value alone, so the token table still matches the prototype for question 12.
