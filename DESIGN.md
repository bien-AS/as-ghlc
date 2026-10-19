---
name: AS Sales App
description: Authority Solutions' internal sales app on top of GoHighLevel, on the Vantage design system.
authority: node_modules/@vantage/design-system (docs/RULES.md, docs/COMPONENTS.md, tokens/)
typography:
  display:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 700
  body:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "13px"
  meta:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "12px"
  micro:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.06em"
  nano:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "10px"
  mono:
    fontFamily: "JetBrains Mono, monospace"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  2xl: "12px"
  3xl: "16px"
---

# Design

**The authority is the Vantage design system**, the one Domain Finder and the other Authority Solutions internal tools use. Its `docs/RULES.md` is law and is not repeated here: dark-first (`:root` is dark, `.light` derives from it), `1rem` is 14px, teal is the only primary-action colour, red is for the logo and danger, `*-ink` text on `*-soft` fills, no resting shadow on cards, colour never the only signal, `null` means not measured.

This file records only what this app adds on top. When the two disagree, Vantage wins and this file is wrong.

## How the app takes Vantage

- **Tokens.** `src/app/globals.css` imports Vantage's two token files into a cascade layer below Tailwind's reset, and points the app's own token names (`ground`, `surface`, `line`, `ink`, `brand`, `ok`, `warn`, `crit`, and shadcn's roles) at Vantage tokens. It also exposes Vantage's own utility names (`bg-surface-inset`, `text-teal-ink`, `text-micro` ...) for Tailwind 4. Add a mapping there; never a raw colour anywhere else.
- **Type sizes.** `text-sm` is 13px (controls, rows, navigation), `text-xs` 11px (small labels), body 14px, page titles 24px. Use Vantage's names (`text-small`, `text-meta`, `text-micro`, `text-nano`) in new code.
- **Class merging.** `cn` from `@/lib/utils` knows Vantage's size names. Do not import the bare `cn` package.
- **Components.** The app keeps its own shadcn components in `src/components/ui`, restyled to Vantage (buttons, pills, fields, focus ring). Vantage's own components (`DataTable`, `KpiTile`, `EmptyState`, `StatusPill`, `CommandPalette` ...) are used directly where a screen needs them; `/dev/vantage` shows them working here.
- **Theme.** The class on `<html>` is `dark` or `light`, set before paint from `as-vantage-theme` in local storage, the same key Vantage's `ThemeToggle` uses.

## What this app adds

- **Sidebar.** Vantage's always-dark chrome in both themes (`--bg-dark`), 240px, the white AS logo, a 3px accent rail and bold label on the current row, count pills. Unlike the kit's `Sidebar` it uses real links, collapses to icons (the logo clips to its shield) and becomes a sheet on small screens.
- **No product name.** The Authority Solutions logo stands in for one; titles read "Page · Authority Solutions".
- **Pills.** Every status is a pill with its word: bold, uppercase, 11px, 4px corners, tone from the status's `rules.ts`. Verdicts: Valid teal, Suspect and Spam red, Awaiting amber. A status that asks for action is amber, never the teal of a good result.
- **Section labels.** `label-caps`: the sans face, 700, 11px, 0.06em, `ink-3`. Mono is for numbers only, and every count, money value and time is tabular.
- **Focus.** One ring everywhere: Vantage's 3px teal (`--shadow-focus`). List rows use an inset 2px teal.
- **Destructive confirm.** In a confirmation dialog the destructive action is the filled red button, and Cancel is the neutral one.
- **The seam.** Every action that writes to GoHighLevel names the write in its confirmation before it happens (spec 06).
- **Touch.** Fields are 16px under a coarse pointer, so iOS does not zoom.

## Motion

Small and tied to state; nothing animates on page load. Buttons, pills and tiles transition colour in 150ms `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`) and press to 0.97. Menus, dialogs, sheets and toasts use their library's transitions. Under reduced motion every animation is cut to an instant change by one global rule; the spinner fades instead of turning.

## Known gaps (from the 14 October design review)

1. The page title shows twice (top bar and page heading), and lead detail repeats the breadcrumb as a back link. Vantage uses one header band.
2. The lead list is not yet the kit's `DataTable` (no sort, density or column choice).
3. Controls are 28px tall on phones; the 44px touch rule covers only the sign-in screen.
4. Scrollbars are unstyled.

## Adding a component

Look in `src/components/ui` and in Vantage first. Build on tokens only, with `cn`, `cva`, a `data-slot` on the root and a `className` passthrough. Give it hover, focus-visible, pressed, disabled and loading states. Add it to `/dev/ui`, check both themes, and follow the design workflow in `AGENTS.md`.
