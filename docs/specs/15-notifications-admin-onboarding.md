---
title: Notifications, admin screens and first run
status: needs-clarification
sessions: S15
registry: notifications-center, profile-settings, team-reps, admin-integrations, admin-templates, welcome-first-run, command-palette
waiting_on:
  - Zachery, Mitchell: which of GHL's 16 internal alerts become in-app notifications (six core types ship either way)
---

# 15. Notifications, admin screens and first run

**Purpose:** tell each person what needs them, let admins run the team and the connections without a developer, and orient a new rep once.

## Notifications (`/notifications`)

Six core types, raised by an Inngest fan-out that respects each person's preferences:

| Type                             | To                                    | Links to                   |
| -------------------------------- | ------------------------------------- | -------------------------- |
| Suspect to review                | The lead's rep, else admins           | Review queue item          |
| Call coming up without a deck    | The lead's rep                        | Lead detail                |
| Recording matched (or unmatched) | The lead's rep; unmatched also admins | Lead detail, or Recordings |
| Proposal viewed / signed         | The lead's rep                        | Proposal detail            |
| Invoice pair ready               | Admins                                | Invoice pair detail        |
| A write to GHL failed            | Admins                                | Sync log                   |

Newest first, open and mark read, mark all read, and an unread count on the bell. Delivery is in-app only; GHL keeps its own alerts. Realtime is Supabase Realtime Broadcast to a per-person channel, with the count refreshed on focus as a fallback.

## Profile (`/settings/profile`)

Name, and per-type notification switches. No password or account deletion: Google only, and admins own the lifecycle.

## Reps (`/admin/reps`)

Admin only. Provision a person by `@authoritysolutions.com` email, name and role: creates the auth user and the profile (ADR-0008). Change role. Set the GHL user each rep is (from `users.readonly`), which is how assigned leads reach them. Deactivate: refused while the person still has assigned leads, then sets the profile inactive and revokes their sessions.

## Integrations (`/admin/integrations`)

Admin only. One card per connection (GHL, Presenton, Smart Pricing Table, Invoice Ninja, Fathom, OpenRouter): status, last successful call, non-secret settings, and "Test". Secrets show only as "set" or "missing" and are never sent to the browser. OpenRouter shows spend this month.

## Templates (`/admin/templates`)

Admin only. The three deck groups with the active template version from the repo, a preview, and the proposal tweak presets (add, edit, remove). Template content is edited in Git, not here.

## First run (`/welcome`) and command palette

Three steps on first sign-in (your leads, the review queue, generating a deck); finishing or skipping clears `first_run`. Cmd-K jumps to any lead, deck or proposal the person may see, through the same lead scope.

## Acceptance checks

1. Each core type reaches only the right people and respects their switch.
2. Provisioning a new email lets that person sign in with Google; deactivating them ends their session at the next request.
3. No integrations response contains a secret.
4. A rep cannot reach any `/admin` route, and none appears in their DOM.

## Open questions

1. Which of the 16 GHL internal alerts are added as types. (Zachery, Mitchell)
