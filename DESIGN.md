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

## The token mapping (`src/app/globals.css`)

- Vantage's two token files are imported into a cascade layer below Tailwind's reset. The app's own names (`ground`, `surface`, `line`, `ink`, `brand`, `ok`, `warn`, `crit`, and shadcn's roles) point at Vantage tokens, and Vantage's utility names (`bg-surface-inset`, `text-teal-ink`, `bg-amber-soft`, `text-micro` ...) are exposed for Tailwind 4. Add a mapping there; never a raw colour anywhere else.
- `--color-popover` is mapped by the app: the kit's `tokens.css` defines no popover role, so without it menus, popovers and dialogs had no background.
- `--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`, so `ease-out` in a class is the strong curve.
- Type: `text-sm` is 13px (controls, rows, navigation), `text-xs` 11px (small labels), body 14px, page titles 24px. New code uses Vantage's names (`text-small`, `text-meta`, `text-micro`, `text-nano`).
- `cn` from `@/lib/utils` knows Vantage's size names, so a size beside a colour is not dropped. Do not import the bare `cn` package.
- Theme: the class on `<html>` is `dark` or `light`, set before paint from `as-vantage-theme`, the key Vantage's `ThemeToggle` uses.

## The sidebar's dark chrome

Vantage's always-dark chrome in both themes (`--bg-dark`), 240px, the white AS logo, a 3px accent rail and bold label on the current row (`--bg-dark-active`), count pills. Unlike the kit's `Sidebar` it uses real links, collapses to icons (the logo clips to its shield) and becomes a sheet below the `nav` breakpoint.

Its entries are the registry's nav gating matrix, in order (`src/app/(app)/navigation.ts`). An entry is drawn only while its screen is live (`src/lib/flags.ts`), and the Admin group is left out of the page for a rep, not hidden. Profile settings live in the user menu.

## Components this app adds (`src/components/ui`)

The app keeps its own shadcn components, restyled to Vantage (buttons, pills, fields, focus ring), and uses Vantage's components directly where a screen needs one (`/dev/vantage` shows them working here). What it adds:

- **Shell:** `app-sidebar`, `top-navbar`, `user-menu`, `sidebar` (the primitive), `auth-shell` (sign-in, access denied, 404 and the root error page).
- **States:** `state-panel` and `offline-banner`, below.
- **Screen parts:** `page-header`, `panel-section`, `list-row`, `status-line`, `verdict-box`, `placeholder-panel`, `slide-frame`, `confirm-dialog`, `form-field`, `link-button`, `local-time`, `theme-switch`, `authority-solutions-logo`.

## States (empty-state-library, error-state-library)

- **Empty:** `EmptyState` in `state-panel.tsx` is the kit's `EmptyState` in a 1px panel. `variant` (`empty`, `filtered`, `notConnected`) is required, as in the kit; there is no default. Copy comes from the screen's `states.empty` in the registry.
- **403 inside the app:** `ForbiddenState`, "You do not have access", for a role-gated read the server refused. Refusals at sign-in go to `/access-denied`.
- **500:** `ErrorState` (announced, with Try again) for a failed read; `error.tsx` boundaries use it inside the shell, and the root `error.tsx` uses the auth frame. Error and forbidden share the kit's empty-state layout (24px `ink-3` icon, 13px bold title, 12px `ink-2` body), so every state reads as one family.
- **404:** `src/app/not-found.tsx`, in the auth frame, with Go to the dashboard.
- **Offline:** a strip under the sticky navbar while the browser reports no connection: `amber-ink` on `amber-soft`, an icon and the words. Its live region is always present, so it is announced.

## Other decisions

- **No product name.** The Authority Solutions logo stands in for one; titles read "Page · Authority Solutions".
- **Pills.** Every status is a pill with its word: bold, uppercase, 11px, 4px corners, tone from the status's `rules.ts`. Verdicts: Valid teal, Suspect and Spam red, Awaiting amber. A status that asks for action is amber, never the teal of a good result.
- **Section labels.** `label-caps`: the sans face, 700, 11px, 0.06em, `ink-3`. Mono is for numbers only, and every count, money value and time is tabular.
- **Focus.** One ring everywhere: Vantage's 3px teal (`--shadow-focus`). List rows use an inset 2px teal.
- **Destructive confirm.** In a confirmation dialog the destructive action is the filled red button, and Cancel is the neutral one.
- **The seam.** Every action that writes to GoHighLevel names the write in its confirmation before it happens (spec 06).
- **Touch.** Fields are 16px under a coarse pointer, so iOS does not zoom.

## Decisions from the 14 October design review

Recorded in commit `f82164f` ("Findings of the design review of the reskin"); each is applied above:

1. Popovers, menus and dialogs get a background from the app's `--color-popover` mapping.
2. The class merger knows Vantage's size names, so it no longer drops a colour or a size.
3. Chips are Vantage pills; buttons and fields take the kit's radius, weight, size and boundary colour (`--border-input`).
4. One focus ring everywhere; a destructive dialog's confirm button is the filled one.
5. Controls and rows are 13px, small labels 11px, body 14px, page titles 24px.
6. Section labels use the sans face; counts are mono; "Needs a decision" is amber, not the teal of "Valid".

Known gaps the review left open:

1. The page title shows twice (top bar and page heading), and lead detail repeats the breadcrumb as a back link. Vantage uses one header band.
2. The lead list is not yet the kit's `DataTable` (no sort, density or column choice).
3. Controls are 28px tall on phones; the 44px touch rule covers only the sign-in screen.
4. Scrollbars are unstyled.

## Motion

Small and tied to state; nothing animates on page load. Buttons, pills and tiles transition colour in 150ms `ease-out` and press to 0.97. A state panel fades in over 150ms (opacity only) when it replaces a skeleton or a list. The offline strip fades in and settles 4px down over 200ms, and leaves at once. Menus, dialogs, sheets and toasts use their library's transitions. The sidebar does not animate its entries. Under reduced motion every animation is cut to an instant change by one global rule; the spinner fades instead of turning.

## Adding a component

Look in `src/components/ui` and in Vantage first. Build on tokens only, with `cn`, `cva`, a `data-slot` on the root and a `className` passthrough. Give it hover, focus-visible, pressed, disabled and loading states. Add it to `/dev/ui`, check both themes, and follow the design workflow in `AGENTS.md`.
