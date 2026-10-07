---
name: Dealwright
description: Dealwright by Authority Solutions, a sales workspace that takes a lead from web form to signed deal.
colors:
  ground: "#f7f4f2"
  surface: "#ffffff"
  surface-2: "#efeae7"
  line: "#dfd7d3"
  ink: "#1e1a18"
  ink-2: "#5f5651"
  ink-3: "#8b8079"
  brand: "#a52b30"
  brand-hover: "color-mix(in oklch, #a52b30, black 14%)"
  brand-ink: "#ffffff"
  brand-text: "#a52b30"
  brand-soft: "#f8e7e7"
  ok: "#2b6e4e"
  ok-soft: "#dceee4"
  warn: "#8a6210"
  warn-soft: "#f6ebd2"
  crit: "#ac3229"
  crit-soft: "#f7dfdb"
  ground-dark: "#2b2827"
  surface-dark: "#353130"
  surface-2-dark: "#403b39"
  line-dark: "#524c49"
  ink-dark: "#ffffff"
  ink-2-dark: "#d2cac5"
  ink-3-dark: "#a69d97"
  brand-dark: "#c93a3f"
  brand-hover-dark: "color-mix(in oklch, #c93a3f, black 14%)"
  brand-ink-dark: "#ffffff"
  brand-text-dark: "#f58a84"
  brand-soft-dark: "#4d2527"
  ok-dark: "#86d1a8"
  ok-soft-dark: "#25402f"
  warn-dark: "#e3b866"
  warn-soft-dark: "#453817"
  crit-dark: "#f4978b"
  crit-soft-dark: "#50282a"
typography:
  heading:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 700
  title:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
  body:
    fontFamily: "Source Sans 3, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  sm: "5px"
  md: "7px"
  lg: "9px"
  xl: "13px"
  2xl: "16px"
  3xl: "20px"
  4xl: "24px"
  control: "9px"
  box: "11px"
  panel: "13px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-default:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  button-danger:
    textColor: "{colors.crit}"
    rounded: "{rounded.lg}"
  button-danger-hover:
    backgroundColor: "{colors.crit-soft}"
  button-link:
    textColor: "{colors.brand-text}"
  chip-neutral:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
  chip-brand:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-text}"
  chip-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
  chip-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
  chip-crit:
    backgroundColor: "{colors.crit-soft}"
    textColor: "{colors.crit}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  input:
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
---

# Design System: Dealwright

> **The palette is provisional.** Every colour, font and radius here comes from the prototype and is assumed. The team has not decided between this palette and the ASVantage design system (open question 12 in `docs/specs/README.md`). All values sit behind named tokens in the two theme blocks at the top of `src/app/globals.css`, so the answer to question 12 is a change of values there and in this file, not of screens.

This file describes the system as it is implemented in the working tree, not as it was planned. The source of truth is `src/app/globals.css` and the components in `src/components/ui`. The plan is `docs/specs/03-ui-foundations.md`; where the code differs from it, the code is recorded here and the difference is listed under [Differences from spec 03](#differences-from-spec-03). A live review page for both themes is at `/dev/ui` in development (`src/app/dev/ui/page.tsx`; it returns not-found in a production build).

## Overview

Dealwright ("Dealwright by Authority Solutions") is a sales workspace that takes a lead from web form to signed deal. The design system gives every screen one set of colours, type, shapes and base components, in a light and a dark theme of equal standing.

The look is a quiet, warm working surface: warm off-white and warm grey neutrals, one red for the brand, three status colours, and a monospaced label face for panel headings. Controls are compact (32px tall by default). Surfaces are flat and separated by a 1px line, not by shadow. The red is spent on the one main action of a screen and on links; everything else is neutral.

The voice is plain and literal. Labels say what a thing is ("Valid", "Awaiting", "Suspect", "Save", "Cancel"). A status is always written as a word, never shown as colour alone.

**Key characteristics:**

- Two themes, light and dark, switched by one class on `<html>`; every colour is a token with a value in each.
- Warm neutrals, one red, three status colours, each status with a soft background partner.
- Three type families with fixed jobs: headings, body and controls, labels.
- Compact controls, 9px control corners, 13px panel corners, full-pill chips.
- Flat surfaces with line borders; shadow is nearly absent.
- Screens use tokens and components only. No screen contains a raw colour value.

## Colors

Warm neutrals carry the interface; one red marks the brand and the main action; green, amber and red-orange mark status.

Tokens are CSS custom properties defined once per theme in `src/app/globals.css` and exposed as Tailwind utilities by name: `bg-ground`, `text-ink-2`, `border-line`, `bg-ok-soft`, and so on.

### Primary

| Token         | Light                                          | Dark                                           | Used for                                                                                           |
| ------------- | ---------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `brand`       | `#a52b30`                                      | `#c93a3f`                                      | Fills only: the primary button, checked checkbox and switch, native control accent                 |
| `brand-hover` | `color-mix(in oklch, var(--brand), black 14%)` | `color-mix(in oklch, var(--brand), black 14%)` | Hover and expanded fill of the primary button. Darker in both themes so `brand-ink` stays readable |
| `brand-ink`   | `#ffffff`                                      | `#ffffff`                                      | Text and icons on a `brand` fill                                                                   |
| `brand-text`  | `#a52b30`                                      | `#f58a84`                                      | Links, the link button, the brand chip's text, the text caret                                      |
| `brand-soft`  | `#f8e7e7`                                      | `#4d2527`                                      | Background of the brand chip; text selection background                                            |

### Status

| Token       | Light     | Dark      | Used for                                                                |
| ----------- | --------- | --------- | ----------------------------------------------------------------------- |
| `ok`        | `#2b6e4e` | `#86d1a8` | Text of the ok chip (for example "Valid")                               |
| `ok-soft`   | `#dceee4` | `#25402f` | Background behind `ok`                                                  |
| `warn`      | `#8a6210` | `#e3b866` | Text of the warn chip (for example "Awaiting")                          |
| `warn-soft` | `#f6ebd2` | `#453817` | Background behind `warn`                                                |
| `crit`      | `#ac3229` | `#f4978b` | Text of the crit chip, the danger button, field errors, invalid borders |
| `crit-soft` | `#f7dfdb` | `#50282a` | Background behind `crit`; hover fill of the danger button               |

### Neutral

| Token       | Light     | Dark      | Used for                                                                         |
| ----------- | --------- | --------- | -------------------------------------------------------------------------------- |
| `ground`    | `#f7f4f2` | `#2b2827` | Page background                                                                  |
| `surface`   | `#ffffff` | `#353130` | Panels, popovers, the sidebar                                                    |
| `surface-2` | `#efeae7` | `#403b39` | Default button fill, neutral chip, hover and muted areas, skeletons              |
| `line`      | `#dfd7d3` | `#524c49` | Borders, dividers, input outlines, the panel edge                                |
| `ink`       | `#1e1a18` | `#ffffff` | Main text; the focus ring; the tooltip surface                                   |
| `ink-2`     | `#5f5651` | `#d2cac5` | Secondary and muted text, placeholders, the label style, the neutral chip's text |
| `ink-3`     | `#8b8079` | `#a69d97` | Defined, but used by no component as text. Only the fifth chart colour reads it  |

### shadcn role mapping

The shadcn/ui components read role names, not the tokens above. `globals.css` maps every role onto a token, so re-theming is done in the token blocks only.

| shadcn role (utility colour)                                                                                                                          | Token                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `background`                                                                                                                                          | `ground`                                |
| `foreground`, `card-foreground`, `popover-foreground`, `secondary-foreground`, `accent-foreground`, `sidebar-foreground`, `sidebar-accent-foreground` | `ink`                                   |
| `card`, `popover`, `sidebar`                                                                                                                          | `surface`                               |
| `primary`, `sidebar-primary`                                                                                                                          | `brand`                                 |
| `primary-foreground`, `sidebar-primary-foreground`                                                                                                    | `brand-ink`                             |
| `secondary`, `muted`, `accent`, `sidebar-accent`                                                                                                      | `surface-2`                             |
| `muted-foreground`                                                                                                                                    | `ink-2`                                 |
| `destructive`                                                                                                                                         | `crit`                                  |
| `border`, `input`, `sidebar-border`                                                                                                                   | `line`                                  |
| `ring`, `sidebar-ring`                                                                                                                                | `ink`                                   |
| `chart-1`, `chart-2`, `chart-3`, `chart-4`, `chart-5`                                                                                                 | `brand`, `ok`, `warn`, `ink-2`, `ink-3` |

Eight plain variables are also declared on every theme scope for the few components that read them with `var()`: `--background` (ground), `--foreground` (ink), `--primary` (brand), `--secondary`, `--muted` and `--sidebar-accent` (surface-2), `--sidebar-border` (line), and `--brand-hover`.

### Contrast

Ratios below are computed from the token values with the WCAG 2 formula.

| Pair                         | Light     | Dark      |
| ---------------------------- | --------- | --------- |
| `ink` on `ground`            | 15.8 to 1 | 14.6 to 1 |
| `ink-2` on `ground`          | 6.5 to 1  | 9.1 to 1  |
| `ink-2` on `surface-2`       | 6.0 to 1  | 6.8 to 1  |
| `ink-3` on `ground`          | 3.5 to 1  | 5.5 to 1  |
| `brand-ink` on `brand`       | 7.0 to 1  | 5.1 to 1  |
| `brand` on `ground`          | 6.4 to 1  | 2.9 to 1  |
| `brand-text` on `ground`     | 6.4 to 1  | 6.2 to 1  |
| `brand-text` on `brand-soft` | 5.9 to 1  | 5.5 to 1  |
| `ok` on `ok-soft`            | 5.1 to 1  | 6.3 to 1  |
| `warn` on `warn-soft`        | 4.6 to 1  | 6.2 to 1  |
| `crit` on `crit-soft`        | 5.1 to 1  | 5.8 to 1  |

### Named rules

**The Fill-Only Brand Rule.** `brand` is a fill, never a text colour. On the dark ground it reaches only 2.9 to 1. Red text and links use `brand-text`, which exists for exactly this and is the same red in light and a lighter one in dark. No component in `src` sets text in `brand` or `primary`.

**The Ink-2 Floor Rule.** Muted and secondary text, placeholders and labels use `ink-2`. `ink-3` is 3.5 to 1 on the light ground, below 4.5, so the muted role and the label style were moved to `ink-2`. Do not set text in `ink-3`.

**The Word Beside Colour Rule.** A status colour never carries meaning alone. A chip always contains its word, and status text sits on its own `-soft` background or on `ground` or `surface`.

**The No Raw Colour Rule.** Screens and components name tokens. A hex value appears only in the two theme blocks of `globals.css`.

### Theming

- **Default:** follow the device setting. **Manual:** the theme switch offers System, Light and Dark. **Persisted:** per browser, not per account.
- Dark is applied by the class `dark` on `<html>`; the Tailwind `dark:` variant is defined as "inside `.dark`". There is no class for light at the root; light is the absence of `dark`.
- The choice is stored in `localStorage` under the key `theme` as `light` or `dark`. Choosing System removes the key. If storage cannot be read, the theme is System; if it cannot be written, the choice still applies for that page view.
- An inline script in `<head>` (`src/app/layout.tsx`) sets the class while the HTML is parsed, so the wrong theme never flashes. It mirrors `src/hooks/use-theme.ts`; the two must be kept in step.
- With System selected, a change of the device setting changes the theme without a reload. A change made in another tab is picked up through the `storage` event. `Providers` subscribes on every page, whether or not a switch is on screen.
- The server and the first client render always see System, so render nothing that depends on the stored choice outside the switch.
- `color-scheme` is set to `light` or `dark` with the tokens, so native controls and scrollbars follow.
- The class `light` on any element re-scopes that subtree to the light token values, and `dark` to the dark ones. The review page uses both to show a light and a dark section side by side. They change token values only: `dark:` utilities follow the nearest `dark` class, not the tokens, which is why the logo takes a `surface` prop for such a section.
- The class `inverse` re-scopes a subtree to the other theme's values (see The Inverse Band Rule).
- Changing theme is instant. Nothing transitions on a theme change.

## Typography

**Heading font:** Bricolage Grotesque (falls back to `ui-sans-serif, system-ui, sans-serif`), weights 600 and 700.
**Body font:** Source Sans 3 (falls back to `ui-sans-serif, system-ui, sans-serif`), weights 400 and 600.
**Label font:** IBM Plex Mono (falls back to `ui-monospace, monospace`), weights 400 and 500.

All three load through `next/font/google` in `src/app/layout.tsx` with the Latin subset and only the weights listed. They reach CSS as `--font-bricolage`, `--font-source-sans` and `--font-plex-mono`, and Tailwind as `font-heading`, `font-sans` and `font-mono`. Text is antialiased.

**Character:** a slightly characterful grotesque for names and titles, a neutral humanist sans for everything a person reads or presses, and a monospace reserved for small uppercase labels.

### Hierarchy

| Role          | Family              | Weight | Size and line height                                       | Use                                                                                  |
| ------------- | ------------------- | ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Heading       | Bricolage Grotesque | 700    | Set per use; no fixed size                                 | Every `h1`, `h2` and `h3`: heading font, bold, tight tracking, balanced wrapping     |
| Title         | Bricolage Grotesque | 600    | `text-base`, snug line height                              | Panel titles (`CardTitle`); `text-sm` in a small panel                               |
| Wordmark      | Bricolage Grotesque | 700    | `text-xl` by default                                       | The Dealwright wordmark, tight tracking                                              |
| Body          | Source Sans 3       | 400    | 15px (`0.9375rem`), 1.5                                    | Running text, controls, inputs. Set on `body` through `text-sm`                      |
| Body emphasis | Source Sans 3       | 600    | 15px, 1.5                                                  | Button text, field labels, emphasis. `font-medium` and `font-semibold` both give 600 |
| Label         | IBM Plex Mono       | 500    | 12px (`0.75rem`), 1.4, 0.08em tracking, uppercase, `ink-2` | The `label-caps` utility: panel headings and section labels                          |
| Mono small    | IBM Plex Mono       | 400    | `text-xs`                                                  | Token names and other short technical strings                                        |

Two Tailwind theme values are redefined, and both change what library components render:

- `text-sm` is 15px on a 1.5 line height, not 14px. shadcn sets body and controls with `text-sm`, so this is how the body size reaches them.
- `font-medium` is weight 600, not 500, because the body font loads only 400 and 600.

Every other size step (`text-xs`, `text-base`, `text-xl` and up) is Tailwind's default.

### Named rules

**The Three Jobs Rule.** Headings and names are Bricolage Grotesque. Everything read or pressed is Source Sans 3. IBM Plex Mono is for small labels only, never for body copy or buttons.

**The Loaded Weights Rule.** Use only loaded weights: 600 and 700 for headings, 400 and 600 for body, 400 and 500 for the label font. Any other weight is synthesised by the browser. In particular, `font-medium` on the label font asks for 600, which is not loaded; use `label-caps`, which sets 500 directly. `font-bold` on body text asks for 700, which is not loaded; use `font-semibold`.

**The Label Is A Heading Rule.** `label-caps` names a panel or a section. It is not a decorative line above a larger headline, and it is not used for body copy. Keep it short.

## Layout

- **Content width:** `max-w-content` is 1280px (`--container-content`). The review page centres it with 24px side padding.
- **Spacing unit:** Tailwind's default 4px step. No spacing tokens are defined in `globals.css`; the scale is not overridden.
- **Rhythm observed in the built components:** 8px between a label, its input and its hint; 20px between fields in a group; 16px panel padding and gap (12px in a small panel); 12px between buttons in a row; 8px between chips.
- **Density:** compact. Default controls are 32px tall.
- **Line length:** running text on the review page is capped at 65 characters.
- **Page frame:** `<html>` is full height; `<body>` is a full-height column, so a page can pin a footer or fill the viewport.
- **Breakpoints:** Tailwind's defaults, plus the handoff's two as named breakpoints: `nav` at 720px and `wide` at 1080px (`--breakpoint-nav`, `--breakpoint-wide`). The dashboard uses only these two: below `nav` the sidebar is a sheet and every screen is one column; from `wide` the sidebar is expanded by default and screens take their full column count. The auth screens and the review page still use `sm` and `md`.
- **Dashboard frame:** a 16rem sidebar (3rem collapsed to icons), a 48px top bar that stays in view, and a main area capped at `max-w-content` with 16px side padding below `nav` and 24px from it.
- **Lead detail columns:** 270px, flexible, 300px from `wide`; flexible and 300px from `nav`; one column below it, in the reading order of spec 06.

## Elevation & Depth

The system is flat. Depth comes from tone and line: `surface` panels sit on `ground` with a 1px `line` edge, and `surface-2` marks hover, muted areas and the panel footer. Panels have no shadow.

The only shadow in the reviewed components is a small one (`shadow-sm`) that marks the selected segment of the theme switch and the active tab. The tooltip separates itself by inverting: an `ink` surface with `ground` text.

Floating library components (popover, dropdown menu, dialog, hover card) still carry shadcn's default shadows. They have not been reviewed against this system; see [Not yet defined](#not-yet-defined).

**The Flat Panel Rule.** A panel is `surface`, a 1px `line` edge and a 13px corner. Do not add a shadow to make it stand out; change the tone or the content instead.

## Shapes

Corners are soft and step with the size of the thing: small on controls, larger on containers, fully round on chips.

| Token                            | Value | Used for                                                                        |
| -------------------------------- | ----- | ------------------------------------------------------------------------------- |
| `rounded-sm`                     | 5px   | Smallest step; nested details                                                   |
| `rounded-md`                     | 7px   | Tooltip, skeleton, small and extra-small buttons, tab and theme-switch segments |
| `rounded-lg` / `rounded-control` | 9px   | Buttons, inputs, selects, the theme switch, tab list                            |
| `rounded-box`                    | 11px  | The verdict box. Reserved for deck boxes, which are not built                   |
| `rounded-xl` / `rounded-panel`   | 13px  | Panels, dialogs                                                                 |
| `rounded-2xl`                    | 16px  | Defined; no reviewed component uses it                                          |
| `rounded-3xl`                    | 20px  | Defined; no reviewed component uses it                                          |
| `rounded-4xl`                    | 24px  | Defined; no reviewed component uses it                                          |
| `rounded-full`                   | pill  | Chips, the switch                                                               |

`rounded-control` and `rounded-panel` are named aliases with the same values as `rounded-lg` and `rounded-xl`. The library components use the `lg` and `xl` names; new hand-built pieces can use either, and the named ones say what the corner is for.

Borders are 1px in `line`. A panel draws its edge as a 1px ring, not a border, so the edge does not change its size.

## Components

Everything below lives in `src/components/ui`. Components are presentational, hold no data access, and are the only place a token is assigned to a role (for example "the danger button uses `crit`").

### Buttons

`src/components/ui/button.tsx`. Compact, flat, and plain about rank.

- **Shape:** 9px corners, 1px border (transparent unless the variant sets it), 32px tall with 10px side padding by default. Text is body 600 at 15px. Icons are 16px.
- **`primary`:** `brand` fill, `brand-ink` text; hover and expanded use `brand-hover`. The one main action on a screen.
- **`default` (no variant given):** the neutral button. `surface-2` fill, `line` border, `ink` text; hover mixes 6% `ink` into the fill.
- **`danger`:** `crit` text and `crit` border, no fill; hover fills with `crit-soft`.
- **`link`:** `brand-text`, underlined on hover with a 4-step underline offset. No fill or border.
- **Library variants kept:** `outline`, `secondary`, `ghost`, `destructive`. They resolve to tokens. Spec 03 defines only primary, default and danger; prefer those three and `link`.
- **Sizes:** `default` 32px, `lg` 36px, `sm` 28px, `xs` 24px, and square `icon`, `icon-lg`, `icon-sm`, `icon-xs` at the same heights. `sm` and `xs` use a 7px corner and smaller text.
- **Disabled:** 40% opacity and no pointer events, for both `disabled` and `aria-disabled`.
- **Loading:** `loading` puts a spinner before the label, sets `aria-busy`, and blocks a second press. The button stays focusable, so focus is not lost while work runs.
- **Pressed:** scales to 0.97. A button that opens a popup does not scale.
- **Focus:** the border turns `ink` and a 3px ring of `ink` at 50% appears, on every variant including `danger`. The ring is 3.3 to 1 against `ground` in light and 4.8 to 1 in dark, and the `ink` border is above 14 to 1. (The danger button used to show a `crit` ring at 30%, about 1.6 to 1; that override was removed.)
- **Motion:** colour, background, border, shadow and scale transition over 150ms on the system's `ease-out` curve.
- A button can render as another element through the `render` prop, for example as a tooltip or dialog trigger.

**The One Primary Rule.** A `Button` with no variant is the neutral button. The main action must ask for `variant="primary"`, and a screen has one.

**The 44px Touch Rule.** Controls keep the compact sizes above on a desktop. On a small screen (below `nav`, 720px) or a coarse pointer, the auth screens' buttons and inputs are at least 44px tall and the show-password control is 44px wide (one rule in `globals.css`, keyed on the auth shell, so no screen sets it), every theme-switch segment is 44px square, and the landing page's calls to action are 44 to 48px. Inline text links are exempt.

### Chips

`src/components/ui/badge.tsx`. A full-pill label, 20px tall, 12px text at weight 600, 8px side padding.

| Tone      | Background   | Text         | Example on the review page |
| --------- | ------------ | ------------ | -------------------------- |
| `neutral` | `surface-2`  | `ink-2`      | "Neutral", "Sample data"   |
| `brand`   | `brand-soft` | `brand-text` | "Brand"                    |
| `ok`      | `ok-soft`    | `ok`         | "Valid"                    |
| `warn`    | `warn-soft`  | `warn`       | "Awaiting"                 |
| `crit`    | `crit-soft`  | `crit`       | "Suspect"                  |

A `Badge` with no variant is the `neutral` chip, matching the `Button` convention that the bare component is the neutral one. Pass a tone whenever the chip carries a status. The library variants `default` (a solid `brand` pill, by name only), `secondary`, `destructive`, `outline`, `ghost` and `link` also remain.

### Panels

`src/components/ui/card.tsx`.

- **Corner:** 13px.
- **Background and text:** `surface` and `ink`.
- **Edge:** 1px ring in `line`. No shadow.
- **Padding:** 16px, and a 16px gap between header, content and footer. `size="sm"` uses 12px.
- **Title:** heading font, weight 600, `text-base`. **Description:** body text in `ink-2`.
- **Optional heading inside the content:** `label-caps`.
- **Footer:** separated by a 1px `line` rule, on `surface-2` at 50%. Holds the panel's actions, primary first.

### Form controls

`input.tsx`, `native-select.tsx`, `field.tsx`, `label.tsx`, `checkbox.tsx`, `switch.tsx`.

- **Field:** a label, the control, then an optional hint or an error, 8px apart. Fields stack 20px apart in a `FieldGroup`. A checkbox or switch sits beside its label with `orientation="horizontal"`.
- **Label:** body font, weight 600, 15px, `ink`. Field labels are not set in the label font.
- **Input and select:** 32px tall, 9px corners, 1px `line` border, transparent background (in dark, `line` at 30%), 10px side padding. Placeholder text is `ink-2`. Input text is 16px below the `md` breakpoint and 15px from it up.
- **Hint:** `FieldDescription`, body text in `ink-2`, tied to the control with `aria-describedby`.
- **Error:** `FieldError`, `crit` text with `role="alert"`, tied to the control with `aria-describedby`. The control takes `aria-invalid`, which gives it a `crit` border and a 3px `crit` ring at 20% (border at 50% and ring at 40% in dark). Setting `data-invalid` on the field turns its label `crit`.
- **Focus:** the border turns `ink` and a 3px ring of `ink` at 50% appears.
- **Disabled:** 40% opacity and no pointer events, the same as buttons. Every component in `src/components/ui` uses 40% for its disabled state (`disabled`, `aria-disabled`, `data-disabled`, and the label of a disabled control).
- **Read-only:** an input inside `FormField` with `readOnly` sets its text in `ink-2`. Forms use it to lock fields while a submit is in progress, so focus is not lost.
- **Form field:** `form-field.tsx` composes the pieces above into one labelled input: `FormField` takes a `label`, an optional `hint` and an `error`, generates the ids, and wires `htmlFor`, `aria-describedby` and `aria-invalid`. An error replaces the hint. `type="password"` adds a show / hide toggle button inside the input (`aria-pressed`, named "Show password").
- **Errors while editing:** editing a field withdraws that field's error (and with it `aria-invalid` and the `aria-describedby` link) until the next submit checks it again; other fields keep theirs. Forms get this by passing `clearErrorOnEdit(setErrors)` from `src/lib/forms.ts` as the form's `onChange`.
- **Checkbox:** 16px, 4px corner, `line` border; checked is a `brand` fill with a `brand-ink` tick.
- **Switch:** a pill; on is `brand`, off is `line`.
- The text caret is `brand-text` and native control accents are `brand`.

### Focus

- Any focused element shows a 2px solid `ink` outline, offset 2px (the global `:focus-visible` rule). Links and native elements get this.
- Library controls replace the outline with their own indicator: an `ink` border and a 3px ring of `ink` at 50%.
- The ring is `ink`, not `brand`, so focus never reads as an error or as a brand fill. It is visible in both themes because `ink` flips with the theme.
- The theme switch shows the ring on the segment that holds the focused radio.

### Theme switch

`src/components/ui/theme-switch.tsx`. Three icon segments, System, Light and Dark, in a `surface-2` track with a `line` border and 9px corners. Each segment is 28px square with a 16px icon and a 7px corner; the selected one is `surface` with `ink` and a small shadow, the others are `ink-2` and turn `ink` on hover. Colour changes take 150ms.

It is a `fieldset` of native radios with a visually hidden legend "Theme" and a hidden text name per option, so arrow keys, grouping and names come from the platform. Each segment also has a `title`. Each instance is its own radio group (its `name` comes from `useId`), so a page can show more than one: each shows the current choice, each is one tab stop, and they stay in step because they read one store. Below `nav`, or with a coarse pointer, each segment is 44px square.

### Wordmark and logo

`src/components/ui/wordmark.tsx` and `src/components/ui/authority-solutions-logo.tsx`.

- **Dealwright is a text wordmark.** `Wordmark` writes "Dealwright" in the heading font, weight 700, tight tracking, `ink`, at `text-xl` unless a text size is passed. There is no Dealwright logo file. In the sidebar, collapsed to icons, the wordmark shortens to its "D".
- **The Authority Solutions logo is an endorsement mark**, not a Dealwright logo. `Wordmark endorsed` adds "by" in body text, `ink-2`, followed by the logo.
- **Two files, one per surface.** `public/as-logo.png` has near-black lettering and is for light surfaces. `public/as-logo-white.png` is the all-white version and is for dark surfaces. Both are 680 by 173 pixels on a transparent background.
- **The theme picks the file.** With `surface="auto"` (the default) both files are in the markup and CSS shows one: the dark artwork normally, the white artwork inside `.dark`. The theme class is set before first paint, so the wrong logo never flashes, and a theme change needs no request.
- **A section can force it.** `surface="dark"` renders only the white file, for a dark-coloured section inside the light theme; `surface="light"` renders only the dark file, for a light section inside the dark theme. `Wordmark` passes `surface` through.
- **Sized by height only.** `AuthoritySolutionsLogo` takes a `height` in pixels (24 by default; 28 inside the wordmark) and derives the width from the fixed 680 to 173 ratio. Its alt text is "Authority Solutions".
- **Large enough to read.** The lockup's second line is small lettering: below about 24px tall it stops being legible. The wordmark's endorsement is 28px (26px in the landing nav, 40px in the landing footer). Do not pass a smaller height.
- **One source for the names.** `src/lib/brand.ts` holds the product name and the endorser's name; the wordmark, the logo's alt text, the landing page and its metadata read them from there.
- **No box.** The logo draws no plate, background, padding or corner of its own. Clear space is the job of the layout around it: keep at least the height of the shield free on every side.

**The Height-Only Logo Rule.** Screens never place either logo file themselves. They use `Wordmark` or `AuthoritySolutionsLogo`, pass a height, and never a width. Never stretch, crop or recolour the artwork.

**The Right File Rule.** The dark artwork goes on light surfaces and the white artwork on dark ones, always. Leave `surface` on `auto` unless the section's tone differs from the theme's, and then say which. Never put either file on a plate to make it legible.

### Auth screens

`src/components/ui/auth-shell.tsx`, used by the layout of every auth route (`src/app/(auth)/layout.tsx`).

- **`AuthShell`:** a header with the endorsed wordmark (logo height 28px) linking to `/` on the left and the theme switch on the right, then one column, 384px wide at most (`max-w-sm`), centred on the page from the `sm` breakpoint and top-aligned below it. Side padding is 16px on small screens, 24px from `sm`.
- **`AuthPanel`:** one state of a screen. An `h1` at `text-2xl`, an optional line under it in `ink-2`, then a panel (`surface`, 1px `line` ring, 13px corner, 20px padding, 20px between its parts), then an optional centred line of links to the neighbouring screens. A screen that swaps state (the form, then "Check your email") renders a new `AuthPanel`; it fades in over 200ms and its heading takes focus so the change is announced.
- **`AuthDivider`:** the word "or" between two 1px `line` rules, in `ink-2`.
- **Actions:** the one `primary` button is the form's submit, full width at size `lg` (36px). "Continue with Google" is a default button with Google's own coloured mark, the only artwork on these screens that is not a token colour. Secondary actions ("Use a different email", "Sign out") are `link` buttons.
- **Messages:** a notice carried by a redirect and a neutral confirmation use `Alert` with `role="status"`; a refused submit uses `Alert variant="destructive"` (`role="alert"`); field errors sit under their field. A countdown is set in tabular numerals so the button does not change width as it ticks.

### Dashboard shell

`app-sidebar.tsx`, `top-navbar.tsx`, `user-menu.tsx`, `role-preview.tsx`, `page-header.tsx`, built on the library's `sidebar.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `breadcrumb.tsx` and `tooltip.tsx`. They take props and fetch nothing; `src/app/dashboard/_components/dashboard-shell.tsx` is the one place that connects them to the route and to data.

- **Sidebar (`AppSidebar`):** `surface` with a 1px `line` edge. The wordmark sits in a 48px header that lines up with the top bar. Items are 32px rows with a 16px icon, in groups with a 1px divider between them: a rep's work first, then the Workspace's own screens under a `label-caps` heading ("Workspace"). A group with no items is left out with its divider, which is how a role that cannot manage the Workspace sees one group. The current item is `surface-2` with weight 600 and carries `aria-current="page"`. A count (suspects waiting, notifications unread) is plain tabular numerals at the row's end, named for assistive technology ("6 waiting", "3 unread"), and is left out when it is unknown or zero. A screen that is not built yet takes a neutral "Soon" chip; no screen does now.
- **Collapsed to icons:** 3rem wide. Each label becomes a tooltip to the right, group headings are hidden, a "Soon" chip becomes a small `ink-2` dot (the tooltip adds "not built yet"), and the count is hidden. The choice is remembered in a cookie and read by the server, so it is applied before first paint.
- **Widths:** from `wide`, expanded unless the person chose otherwise. Between `nav` and `wide`, icons by default, and expanding overlays the page instead of squeezing it. Below `nav`, the sidebar is a sheet from the left, opened by the top bar's navigation button; Escape, the backdrop and choosing an item close it.
- **Top bar (`TopNavbar`):** 48px, `ground`, a 1px `line` rule under it, stays in view. Left to right: the navigation button (it says whether the navigation is expanded), the breadcrumb, the lead search, the "Sample data" chip, the notifications link, the role preview, the user menu. Below `nav` the search is an icon that turns the bar into the field, and the role preview and the Sample data note move into the user menu. The top bar carries no theme switch; the theme is chosen in the user menu.
- **Unread mark:** when there are unread notifications the bell carries a 16px-tall pill at its top right corner, `brand` fill with `brand-ink` tabular numerals ("99+" above 99). It is the one place outside a button where `brand` is a fill, and it never stands alone: the link's name and tooltip say "Notifications, 3 unread".
- **Role preview (`RolePreview`):** a default button reading "Viewing as" in `ink-2` followed by the role in `ink`, with an eye icon and a chevron. Its menu is headed "Viewing as (preview)", lists each role as a radio item with one line in `ink-2` saying what the role sees, and ends with a line in `ink-2` at 12px saying it is a preview and not access control. While a switch is being saved the button shows the spinner and the choices are inert. `RolePreviewGroup` is the same choices as a menu group, for the user menu on small screens. It exists only while the dashboard runs on sample data.
- **Breadcrumb:** the current screen in `ink` weight 600, truncated with its full text as a title; earlier steps are `ink-2` links.
- **Sample data chip:** a neutral chip that is a button, so it can take focus; its tooltip says the leads are examples and changes are not kept.
- **User menu (`UserMenu`):** the trigger is the person's initials in a 24px `brand-soft` circle with `brand-text` letters, plus their name from `wide`. The menu shows name and email, then Settings (a link to the person's own Account settings), the theme as three radio items (System, Light, Dark; choosing one keeps the menu open), and Sign out. Below `nav` it also holds the role preview's choices and the Sample data note.
- **Page header (`PageHeader`):** an `h1` at `text-2xl`, an optional line in `ink-2` capped at 65 characters, optional actions on the right. Every dashboard screen's `h1` can take focus: after navigation the shell moves focus to it.
- **Skip link:** "Skip to content" is the first focusable element and is visible only while focused.

### Dashboard pieces

- **Verdict box (`verdict-box.tsx`):** an 11px-corner box on the tone's soft background with a 1px edge of the tone at 30%. The verdict word is 16px weight 600 in the tone, with an icon; the summary and the reasons (a bulleted list) are `ink`. Tones: `ok` for valid, `warn` for awaiting, `crit` for suspect and spam. An optional note under the reasons says who reviewed the lead and when.
- **Hint line (`hint-line.tsx`):** one line in `ink-2` with a 16px info icon, under a lead's actions. A polite live region.
- **Status line (`status-line.tsx`):** a lead's status in a dense list: the words in `ink`, with an 8px dot in the tone before them. The dot never stands alone.
- **List row (`list-row.tsx`):** the whole row is one link, 10px by 16px padding. Hover and keyboard focus use `surface-2`; focus adds a 2px inset `ink` edge. The selected row is `surface-2` with a 2px inset `brand` left edge and `aria-current`. A removed lead's name is struck through in `ink-2`, with "left the pipeline" for assistive technology.
- **Empty state and error state (`state-panel.tsx`):** a centred heading at 16px weight 600 in the heading font, one sentence in `ink-2` and an optional action, inside a 1px `line` edge with a 13px corner and no fill. The error state is announced (`role="alert"`) and its action is "Try again". `NotAllowedState` is the empty state with fixed words for a role that cannot use a screen: "You do not have access to this screen".
- **Panel section (`panel-section.tsx`):** the titled panel every dashboard screen is made of: a `label-caps` heading over its content on `surface`, a 1px `line` ring, a 13px corner, 16px padding and 12px between its parts. `actions` puts a control on the heading's line. Lists inside it are rows with dividers, not panels of their own.
- **Placeholder panel (`placeholder-panel.tsx`):** a panel with the screen's name as the `h1`, a neutral "Not built yet" chip, one sentence in `ink-2`, then a `label-caps` "Waiting on" heading over a bulleted list. No controls.
- **Confirm dialog (`confirm-dialog.tsx`):** the alert dialog for an action that cannot be undone. The title names the lead, the description says what will happen, Cancel is the default button and the confirming action is a `danger` button, so the dialog adds no second `primary` to the screen.
- **Link button (`link-button.tsx`):** a link with the button's look. Use it, not `Button render={<Link />}`, when the control goes somewhere: it stays a link to assistive technology.
- **Local time (`local-time.tsx`):** a `<time>` in the viewer's time zone ("Wed, Oct 7, 2:30 PM"), with the full date and zone as its title. The locale is fixed to `en-US` so server and browser print the same text.
- **Needs-you tiles (Pipeline):** four 56px-tall buttons with a 9px corner, `surface` and a `line` border: the count in the heading font at `text-xl` with tabular numerals, the label in `ink-2`. The pressed one has an `ink` border and `surface-2`. A zero is inactive at 40%.
- **Stage tabs (Pipeline):** the library's line tabs with each count in `ink-2` after its label. The three exits follow a short vertical `line` rule. The row scrolls sideways on narrow screens.

**The Verdict And Status Tone Rule.** A verdict or status takes its tone from the one mapping in `src/lib/leads/rules.ts` (`VERDICT_META`, `STATUS_META`). No screen chooses a tone for one itself. The same holds for every other status the mockups added (a proposal, an invoice, a connection, an invite, a notification): each has one mapping in its own `src/lib/<entity>/rules.ts`.

**The Workspace Below The Line Rule.** In the sidebar, a person's work sits above the divider and the Workspace's own screens below it. Settings in the sidebar are the Workspace's. A person's own settings are reached from the user menu and never appear in the sidebar.

**The Labelled Preview Rule.** Anything that only previews or simulates (the role preview, a "simulate" action on a mockup, a field whose value is discarded) says so in words where it is used, in the control or in a line beside it, never in a tooltip alone. The "Sample data" chip in the top bar does not replace that line.

### Other reviewed pieces

- **Tabs:** a `surface-2`-toned list, 32px tall, 9px corners; triggers are body 600 with a 7px corner. Keyboard-operable through the library primitive.
- **Skeleton:** a `surface-2` block with a 7px corner that pulses. Shape it like the content it stands in for.
- **Tooltip:** `ink` surface, `ground` text, 12px text, 7px corner. Opens after a 300ms delay with a short fade and scale.
- **Spinner:** a 16px rotating icon with `role="status"` and the name "Loading". With reduced motion it stops rotating and fades between full and 30% opacity every 1.6 seconds instead, so it still shows that work is in progress.
- **Alert dialog:** its confirming action is a `primary` button.

### Marketing pages

The landing page (`src/app/page.tsx`, spec 01) is the one public marketing surface. It uses the same tokens and type families at a larger scale, and these pieces in `src/components/ui`:

- **`SiteNav`:** a 64px bar that stays in view: the endorsed wordmark, in-page anchors from `lg`, the theme switch from `nav`, then Sign in (default) and Sign up (primary). Below `nav` the two buttons are 44px tall and the endorsement stacks under the name. Its surface is opaque `ground` with a `line` rule, so nothing shows through it, whatever passes underneath.
- **`SectionShell`:** one band: a `<section>` named by its heading, the 1280px content column with 20px side padding (32px from `sm`), and 80 / 112 / 144px of vertical space by breakpoint.
- **`StickyNarrative`:** a numbered story beside its pictures. From `lg` (and at least 672px of height) it pins under the nav while the page scrolls through it, and each step holds for the same 60vh of scroll; otherwise it is a list, each step with its picture beside it from `lg` and under it (at most 704px wide) below.
- **`FeatureSwitcher`:** a set of items with exactly one open. Each header is a button with `aria-expanded`; arrow keys, Home and End move between headers. A row from `xl`, 432px tall, with one-line titles so every summary starts on the same line and a closed item's plus at its foot; a stack below `xl`.
- **`Marquee`:** a drifting row whose items exist once as a real list; the copies are hidden from assistive technology. It is focusable so it can be paused from the keyboard; the focusable element is not the clipped one, so its focus ring is painted in full.
- **`InView`:** sets `data-inview` on its element so CSS can reveal `[data-reveal]` children once, or pause a loop while off screen.
- **`SiteFooter`:** link columns, the endorsement at 40px, the theme switch below `nav` only (the nav carries it from `nav` up, so one is on screen), and the product name at 17.6vw cropped by the bottom of the page.

Scale and shape on this surface: section headings are `clamp(2rem, 4.2vw, 3.25rem)` with -0.03em tracking, the `h1` `clamp(2.5rem, 4.9vw, 4rem)`; body copy is 17 to 18px in `ink-2`; calls to action are 48px tall. Picture stages and the facts card use the 24px corner (`rounded-4xl`), panels inside them 13px, verdict boxes 11px, chips the pill. Surfaces stay flat: no shadow.

**The Inverse Band Rule.** A page's one tonal break is a band with the class `inverse`, which re-scopes its subtree to the other theme's tokens: dark values in the light theme, light values in the dark theme. Give it `bg-ground text-ink` and build inside it with tokens as usual; no extra colour token is needed. It is inverse and not always-dark because the dark tokens on the dark ground barely separate. `dark:` utilities do not follow it (they follow the nearest `dark` class), so use token utilities inside a band, not `dark:` ones, and do not place the Authority Solutions logo with `surface="auto"` there. The logo is not shown in the landing page's band.

**The Drawn Picture Rule.** Marketing pictures are drawn in markup from tokens and from the app's own chips, labels and wording (`src/lib/leads/rules.ts`), never from screenshots, stock or generated images. Each is one `role="img"` with a sentence describing it, uses made-up names, and says "Sample data" in a chip on a `surface` panel wherever it shows a lead. A picture is composed in two planes: a panel behind, and a panel in front that overlaps it and carries a 7px band of the ground colour around its 1px edge, so the overlap reads as depth without a shadow. Its 24px-corner ground is `surface-2` with a soft radial wash of one status or brand `-soft` token.

**The Planned Label Rule.** A capability that is not built (decks, proposals, invoicing) carries a `warn` chip reading "Planned" wherever the page goes into detail on it.

### Motion

Motion is small and tied to state. In the app nothing animates on page load, and the dashboard adds no motion of its own beyond the rows below. The marketing page has its own table after this one.

| What                                             | How                                                             |
| ------------------------------------------------ | --------------------------------------------------------------- |
| Button colour, background, border, shadow, scale | 150ms, `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`)            |
| Button press                                     | Scale to 0.97                                                   |
| Theme switch segment colour                      | 150ms                                                           |
| Tooltip                                          | 300ms open delay; fades and scales in and out                   |
| Skeleton                                         | Continuous pulse                                                |
| Spinner                                          | Continuous rotation; a 1.6s opacity fade under reduced motion   |
| Auth panel state swap                            | 200ms fade in, `ease-out`; opacity only                         |
| Inputs, selects, chips, tabs, switch             | A colour or position transition at the library's default timing |
| Needs-you tile colour, border and press          | 150ms, `ease-out`; press scales to 0.98                         |
| Lead list while a filter loads                   | Opacity to 60% over 150ms; the rows stay in place               |
| Sidebar collapse, sheet, menus, dialogs, toasts  | The library's own transitions, unchanged                        |
| Theme change                                     | Instant                                                         |

The `ease-out` token is redefined as `cubic-bezier(0.23, 1, 0.32, 1)`, so every `ease-out` utility uses it.

#### Marketing motion

All of it is in `src/app/marketing.css`. Every rule's resting state is the finished, still composition; movement is added only inside `prefers-reduced-motion: no-preference`. So reduced motion, no JavaScript and a browser without scroll-driven animations all show the same complete page, not a half-played one. This is why these rules are gated instead of relying on the global reduced-motion rule alone: that rule shortens durations but keeps delays, which would leave delayed pieces hidden for a moment.

| What                                     | How                                                                                                                                                                                                                                                                                                                                                                                                                            | Reduced motion                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Nav settles                              | Scroll-driven over the first 96px: the surface's and rule's opacity 0 to 1, the row's `translateY` 10px to 0. Linear, tied to scroll                                                                                                                                                                                                                                                                                           | The settled bar from the start                                           |
| Hero picture assembles                   | Once on load: opacity and `translateY(18px)`, 800ms `ease-out`, 70ms apart. The headline, the paragraph and the button do not animate                                                                                                                                                                                                                                                                                          | The assembled picture                                                    |
| A lead receives its verdict              | Once, when the hero picture is seen: 2.1s after load if it is on screen then, otherwise 0.9s after it scrolls into view. "Awaiting" fades and blurs out over 450ms, "Valid" fades in from `scale(0.98)` over 650ms, `ease-out`; the awaiting icon turns once while it waits                                                                                                                                                    | "Valid" from the start                                                   |
| Stages light up, a lead travels the rail | Once, when the row scrolls in: each stage's opacity 0.28 to 1 and its number's scale 0.8 to 1, 380ms apart; the rail draws with `scaleX` and a sample lead's initials move along it with `translateX`, both over 2.1s on `cubic-bezier(0.45, 0, 0.55, 1)`; then the exits' bracket and chips fade in                                                                                                                           | All stages lit, the lead above the last stage, bracket and exits present |
| Points and exits arrive                  | Once, on scroll in: opacity and `translateY(14px)`, 700ms `ease-out`, 80ms apart                                                                                                                                                                                                                                                                                                                                               | All present                                                              |
| Narrative step change                    | The pinned block's current step is marked (colour, 300ms). Its picture fades and rises in over 500 to 600ms `ease-out`, parts 80ms apart; the last one leaves upwards in 220ms. Then the picture's one change of state plays at about 1.3s: the verdict resolves from "Awaiting verdict" to "Valid"; the stage chip and the next-step line change from sent to signed (opacity, blur 3px, scale 0.98; 400 to 600ms `ease-out`) | A list: each step with its picture in its final state                    |
| Feature item opens                       | Row: `flex-grow` over 420ms `ease-out` inside a fixed-height, layout-contained box; texts and pictures have fixed widths so nothing re-wraps; picture opacity 280ms. Stack: `grid-template-rows` over 320ms. Header press scales 0.98                                                                                                                                                                                          | The same state change, instant                                           |
| Marquee                                  | `translateX` by one copy, 44s linear, without end. Paused on hover, on keyboard focus and while off screen                                                                                                                                                                                                                                                                                                                     | Still: the one list, wrapped and centred, no copies                      |
| Numbers settle                           | Once, on scroll in: `translateY(45%)`, 8px blur and opacity to rest, 900ms `ease-out`, 120ms apart                                                                                                                                                                                                                                                                                                                             | Numbers in place                                                         |
| Footer wordmark                          | Scroll-driven as the footer enters: `translateY(45%)` and opacity 0.2 to rest                                                                                                                                                                                                                                                                                                                                                  | In place                                                                 |
| Closing call to action                   | Nothing beyond the buttons' own hover, focus and press                                                                                                                                                                                                                                                                                                                                                                         | The same                                                                 |

Only `transform`, `opacity` and `filter` animate, with one exception: the feature switcher changes track sizes, which has no transform equivalent; it is contained and user-initiated. Nothing delays the headline or a call to action, nothing loops except the marquee, and no animation moves layout around it.

**Reduced motion.** When the device asks for reduced motion, every animation and transition on every element is cut to 0.01ms and one iteration, and smooth scrolling is turned off. This is a single global rule in `globals.css`; components do not need their own. State changes still happen; they are instant. The one exception sits beside that rule in `globals.css`: the spinner swaps its rotation for a slow opacity fade (`spinner-fade`), because a frozen spinner reads as a static icon and no longer says that anything is happening.

## Do's and Don'ts

### Do:

- **Do** name a token for every colour: `bg-surface`, `text-ink-2`, `border-line`.
- **Do** use `brand-text` for links and any red text, in both themes.
- **Do** ask for `variant="primary"` on the one main action; leave other buttons on the default.
- **Do** pass a tone to a chip that carries a status (`brand`, `ok`, `warn`, `crit`) and put the status word inside it. A bare chip is `neutral`.
- **Do** use `text-muted-foreground` or `text-ink-2` for secondary text.
- **Do** tie a hint or an error to its input with `aria-describedby`, and set `aria-invalid` on the input.
- **Do** use `label-caps` for a panel or section heading in the label font.
- **Do** place the endorsement through `Wordmark endorsed` and size the logo by height.
- **Do** take a verdict's or a status's tone from `VERDICT_META` and `STATUS_META`, and any other status's tone from its own `rules.ts`.
- **Do** build a dashboard screen from `PageHeader` and `PanelSection`s, with lists as divided rows inside a panel.
- **Do** say in words, beside the control, when an action is only simulated on sample data.
- **Do** use `LinkButton` for a control that goes somewhere and `Button` for one that does something.
- **Do** use the `nav` and `wide` breakpoints on dashboard screens.
- **Do** check both themes on `/dev/ui` when a token or base component changes.

### Don't:

- **Don't** write a hex or other raw colour outside the two theme blocks in `globals.css`.
- **Don't** set text in `brand` or `primary`. On the dark ground it is 2.9 to 1.
- **Don't** set text in `ink-3`. On the light ground it is 3.5 to 1.
- **Don't** let colour carry a status alone.
- **Don't** expect a bare `<Button>` to be the brand button, or a bare `<Badge>` to be anything but the neutral chip.
- **Don't** use a weight that is not loaded: no 500 or 700 in body text, no 600 in the label font.
- **Don't** add a shadow to a panel.
- **Don't** reference either logo file from a screen, give the logo a width, put it on a plate, or show the dark artwork on a dark surface or the white artwork on a light one.
- **Don't** add per-component reduced-motion overrides; the global rule covers them (the spinner's fade is part of that rule). Marketing motion is the other way round: it is added under `no-preference`, never removed under `reduce`.
- **Don't** read the stored theme during server render; it is always System there.

## Accessibility

- **Text contrast:** every text and background pair in the reviewed components is at or above 4.5 to 1 in both themes (see the contrast table). `brand` and `ink-3` are the two tokens that fail as text, and neither is used as text.
- **Colour is never the only signal:** chips carry their word; errors are text with `role="alert"`, not only a red border.
- **Focus is always visible:** a 2px `ink` outline by default, or the control's `ink` border and ring. Do not remove an outline without replacing it.
- **Keyboard:** every control is a native element or a Base UI primitive. The theme switch is a native radio group. A loading button stays focusable.
- **Names:** icon-only controls need a text name. The theme switch uses hidden text per option; the spinner is named "Loading"; decorative icons are `aria-hidden`.
- **Forms:** labels are tied to controls with `htmlFor`; hints and errors with `aria-describedby`; invalid state with `aria-invalid`.
- **Reduced motion** is honoured globally.
- **Zoom and input size:** sizes are in rem. Inputs are 16px on small screens.
- **Language:** the document is `lang="en"`.

## Adding a component

Per `AGENTS.md` and spec 03: a piece of interface used, or likely to be used, by more than one screen is a component in `src/components/ui`. Pages compose components and hold no markup another page would need.

1. Look in `src/components/ui` first. Most shadcn/ui primitives are already installed there; re-theme and reuse one before writing a new one.
2. Follow the design workflow in `AGENTS.md` for any UI work, and read the Next.js docs in `node_modules/next/dist/docs/` before writing code.
3. Build on tokens only: token or role utilities for colour, `rounded-control`, `rounded-box` or `rounded-panel` for corners, the three font utilities for type. No raw colour.
4. Keep it presentational. No data access in a component; client calls live in TanStack Query hooks (see `docs/adr/`).
5. Give it the states it needs: default, hover, focus-visible, pressed, disabled, and loading where it triggers work. Use the focus treatment above.
6. Follow the file conventions already in the folder: a `data-slot` attribute on the root, `cn()` for class merging, `cva` for variants, a `className` passthrough, named exports.
7. Add it to `src/app/dev/ui/page.tsx` and check it in both themes and with reduced motion on.
8. Test behaviour a user relies on, as `src/components/ui/foundations.test.tsx` does, not appearance.
9. If it adds a durable rule or token, record it in this file.

## Not yet defined

These are named in spec 03 or implied by the product, but nothing in the code defines them yet. Do not treat any of them as settled.

- The dashboard has not been looked at by a person in a signed-in browser. Its shell and screens are built to this file and the specs and are covered by tests, but spacing, the sidebar's collapsed and sheet forms, and both themes still need a visual pass.
- A fixed size for each heading level. Headings take the heading font and weight globally; sizes are set per use.
- A spacing scale of our own. Tailwind's default is in use.
- Screen-level motion in the app (the marketing page's is defined above).
- A review of the installed shadcn/ui components that are not on the review page (dialog, alert dialog, sheet, dropdown menu, popover, table, toast and others). The dashboard now uses the alert dialog, sheet, dropdown menu, toast and sidebar as the library ships them. They resolve to the tokens through the role mapping, but still carry library defaults such as shadows and `ink` at 10% edges.
- A Dealwright logo.
- The final palette (question 12).

## Differences from spec 03

The code is what is documented above. These are the places it departs from `docs/specs/03-ui-foundations.md`.

| Topic            | Spec 03                                                            | Code                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body size        | 15px, line height 1.5                                              | The same, but reached by redefining Tailwind's `text-sm` to 15px on 1.5                                                                                             |
| Medium weight    | Body weights 400 and 600                                           | `font-medium` is remapped to 600                                                                                                                                    |
| Labels and hints | `ink-3`, restricted to labels of 14px bold or larger               | `ink-2` for muted text, placeholders and `label-caps`. `ink-3` keeps its value and is not used as text                                                              |
| Label size       | 10.5 to 12px                                                       | `label-caps` is 12px                                                                                                                                                |
| Field labels     | Label font                                                         | Body font, weight 600, 15px                                                                                                                                         |
| Focus ring       | "Visible in both themes"; colour not specified                     | `ink`, not `brand`                                                                                                                                                  |
| Brand hover      | Not in the token table                                             | Extra token `brand-hover`                                                                                                                                           |
| Radius names     | Values only                                                        | Extra tokens `rounded-control` (9px), `rounded-box` (11px), `rounded-panel` (13px)                                                                                  |
| Content width    | 1280px                                                             | The same, as the extra token `max-w-content`                                                                                                                        |
| Button kinds     | Primary, default, danger                                           | A `Button` with no variant is the neutral button; the main action needs `variant="primary"`. Library variants `outline`, `secondary`, `ghost`, `destructive` remain |
| Default button   | `surface-2` fill with a `line` border                              | The same                                                                                                                                                            |
| Chip tones       | Five tones                                                         | Five tones as `Badge` variants, `neutral` being the default; the library's other variants remain by name                                                            |
| Logo on dark     | Now the same: spec 03 was updated when the white file was supplied | The owner supplied `public/as-logo-white.png`. The white file is shown on dark surfaces and the dark file on light ones; there is no plate and no text fallback     |
| Breakpoints      | Two columns below 1080px, one below 720px                          | The same, as the named breakpoints `wide` and `nav`                                                                                                                 |
| Colour values    | Uppercase hex                                                      | The same values in lowercase                                                                                                                                        |
