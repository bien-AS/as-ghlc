---
title: Settings and integrations
status: to-be-scoped
blocked_by:
  - question 9
  - question 10
  - question 11
owner_to_ask:
  - Zach
  - Mitchell
  - Project lead
build_now: false
---

# 16. Settings and integrations

> **To be scoped.** Agreed in direction only. This is a placeholder, not a spec.

A screen for admins and owners where a Workspace is connected to its tools: the connected CRM and its sync status, and the keys for the proposal, invoice and deck services, with actions to connect a CRM, import leads and map stages. It also covers any CRM adapter beyond the first. It cannot be scoped until three questions are answered: what kind of product this is and who the second customer is (question 9; assumed a shared app with a Workspace per customer; Zach, Mitchell), whether the proposal, invoice and deck tools are fixed or become adapters too (question 10; assumed fixed in the first version; Zach), and which CRM adapters come in what order, whether n8n has a role and what a CRM without sequences or calendars needs (question 11; assumed GHL first, Zoho next, no n8n; Project lead, Zach). In the first build the screen was a placeholder at `/dashboard/settings` (spec 04); it is now the two mockups described below.

## As built (mockup)

> **This is a mockup.** It runs on sample data, connects to nothing outside the app, and is built on the assumptions listed here. This spec's status and its open questions are unchanged.

**Owner decisions made for the mockup.** These are decisions, not assumptions:

- This spec's one screen is **two screens with two sidebar entries**: **Workspace settings** and **Integrations**.
- Settings in the sidebar belong to the Workspace. A person's own settings are a third screen, **Account settings**, reached from the user menu (recorded in spec 08).
- The Integrations screen is for admins and owners and **names providers by brand**, because an admin must know what they are connecting. Every brand name lives in one table, `src/lib/connections/providers.ts`. Everything a rep reads still names none.
- "Integrations" names the screen only. A single link to a service is a Connection (`GLOSSARY.md`).

Both screens are for admins and owners. Viewed as Staff in the role preview they say "You do not have access to this screen", and their routes answer 403 `forbidden`.

### Workspace settings (`/dashboard/settings`)

- **Workspace:** its name.
- **Branding:** a display name and logo initials, with a small preview. The app's own look does not change.
- **Who can join:** the allowed email domains, with add and remove, and one sentence stating the rule from spec 12. It links to Users and roles.
- A Workspace cannot be created or deleted here.

### Integrations (`/dashboard/integrations`)

One panel per Connection type, in the order CRM, proposals, invoices, decks. Each shows the provider, a status with its word, and when it last synced.

- **Connect** (a key field) and **disconnect** on every panel.
- For the CRM: **Sync now**, **Import leads** (it reports what an import did), and **Map stages** (each of the app's six stages against one of the CRM's stage names).
- The CRM panel lists the first CRM as available and the next as "Planned".
- The proposal, invoice and deck panels offer no choice of provider and say the service is fixed in the first version.

**Assumptions and mock choices**

| Where                                                                                    | Question           | What is assumed                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `ONE_SHARED_APP_WORKSPACE_PER_CUSTOMER` in `src/lib/workspace/rules.ts`                  | 9 (assumed)        | One shared app with a Workspace per customer.                                                             |
| `WORKSPACE_SELF_SERVE` in `src/lib/workspace/rules.ts`                                   | 9 (mock choice)    | No self-serve creation or deletion of a Workspace (spec 12).                                              |
| `JOIN_RULE` in `src/lib/workspace/rules.ts`                                              | 7 (proposed)       | Allowed domain **or** invite, following the handoff. The architecture review's "plus" is the other value. |
| `STAGE_SYNC_DIRECTION` in `src/lib/connections/rules.ts`                                 | 1 (assumed)        | The app owns the stage and pushes it out, so the mapping runs from the app's stages to the CRM's.         |
| `providerIsFixed` in `src/lib/connections/rules.ts`, `FIXED_PROVIDERS` in `providers.ts` | 10 (assumed)       | The proposal, invoice and deck tools are fixed in the first version.                                      |
| `CRM_PROVIDERS` in `src/lib/connections/providers.ts`                                    | 11 (assumed)       | GHL first, Zoho next (shown as planned and not connectable), no n8n.                                      |
| Branding is a display name and initials                                                  | None (mock choice) | Spec 09 lists "branding" on a Workspace and puts per-Workspace branding in the interface out of scope.    |

**What is faked**

- Every Connection. Connecting checks that the key is not empty and then **discards it**: it is not stored, logged or returned, and nothing is contacted. The screen says so beside the field. No response of any route contains a credential or a reference to one (spec 09, rule 6), and a test checks that.
- "Sync now" only records the time. "Import leads" always reports every sample lead as already here and none added, which is what spec 09's rule 1 requires of a second import.
- The CRM's stage names are seven invented ones. Saving the mapping changes no lead.
- The allowed domains are stored and gate nothing, because sign-up is open (ADR-0004). Removing a domain removes nobody.
- The Workspace itself is one sample record.

**To go live** (function bodies only): in `src/lib/data/workspace.ts`, `getWorkspace`, `updateWorkspace`, `addAllowedDomain` and `removeAllowedDomain`; in `src/lib/data/connections.ts`, `listConnections`, `connect`, `disconnect`, `syncNow`, `importLeads`, `getStageMapping` and `saveStageMapping`; in `src/lib/services/crm.ts`, the one place the CRM adapter's client will live (spec 11), `connect`, `syncStatus`, `listStages` and `importLeads`. Connecting the proposal, invoice and deck services will call their own modules under `src/lib/services/`.
