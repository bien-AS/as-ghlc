# AS Sales App specs

What gets built is set by the **build packet** (`docs/packet/`, 7 October 2026) and the **screen registry** (`screen-registry.json`, 36 screens; readable copy in `docs/packet/screen-registry.md`). These specs say how, one per build session or group of sessions, in the packet's order. They add what the packet and registry leave open and record where this repo differs (ADR-0007).

Order of authority when two sources disagree: a decision by Zachery or Mitchell, then the registry, then these specs, then the packet's prose. GoHighLevel facts are settled by a live call against the dev location.

The earlier Dealwright specs (a multi-CRM product with workspaces) are in `superseded/` for reference only. Nothing in them is a requirement.

## Status legend

| Status              | Meaning                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| ready               | Decided, with enough detail to build                                      |
| needs-clarification | Buildable on a stated assumption; the question is listed with who answers |
| blocked             | Needs an access key, a file or a person's input before it can be built    |

An assumption is never a requirement. "Assumed" means waiting for someone to confirm.

## Index

| Spec                                                                       | Sessions | Registry screens                                                                                                           | Status              | Waiting on                                                                         |
| -------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| [01 Foundations](01-foundations.md)                                        | S1 to S5 | login, auth-callback, access-denied, empty and error state libraries                                                       | ready               | Google OAuth client; Supabase org and Vercel team access (owner steps, not code)   |
| [06 GHL connector](06-ghl-connector.md)                                    | S6       | sync-log                                                                                                                   | blocked             | Lee: dev location, token, ids, webhooks                                            |
| [07 Leads, research, dashboard](07-leads-research-dashboard.md)            | S7       | dashboard, lead-list, lead-detail                                                                                          | needs-clarification | Spec 06; research sources (Zachery)                                                |
| [08 Validation and review queue](08-validation-and-review-queue.md)        | S8       | suspect-review-queue, validation-log                                                                                       | blocked             | Typeform export (Bien, needs access)                                               |
| [09 Decks on Presenton](09-decks-presenton.md)                             | S9, S10  | deck-generate, deck-detail, deck-edit, deck-library, first-value-celebration                                               | needs-clarification | Render deploy (Bien); enhanced templates (Mitchell, Zachery); calendar embed (Lee) |
| [11 Meetings from Fathom](11-meetings-fathom.md)                           | S11      | meeting-recordings                                                                                                         | needs-clarification | Fathom integration user and key; five API checks                                   |
| [12 Proposals](12-proposals.md)                                            | S12      | proposal-generate, proposal-detail, proposal-list                                                                          | blocked             | SPT credentials and template id (Zachery); proposal link field (Lee)               |
| [13 Signature and invoices](13-signature-and-invoices.md)                  | S13      | invoice-approvals, invoice-pair-detail                                                                                     | blocked             | Invoice Ninja verdict and access (Zachery); Lead Won workflow (Lee)                |
| [14 Status mirror and pipeline](14-status-engine-and-pipeline.md)          | S14      | pipeline-board, admin-statuses                                                                                             | needs-clarification | Lee: thresholds, and who moves leads on silence                                    |
| [15 Notifications, admin, first run](15-notifications-admin-onboarding.md) | S15      | notifications-center, profile-settings, team-reps, admin-integrations, admin-templates, welcome-first-run, command-palette | needs-clarification | Which GHL alerts become notifications                                              |
| [16 Hardening and launch](16-hardening-and-launch.md)                      | S16, S17 | none                                                                                                                       | ready               | Lee: test location; Zachery: production accounts                                   |

S0 (Bien's machine) is `docs/packet/build-plan.md` and the packet's `ONBOARD.md`; it has no spec. Phase 4 screens (`reports-hub`, `admin-analytics`, `invoice-manager`, `admin-routing`, `loading-skeleton-library`) are not specified until they are scheduled.

## Decisions that shape these specs

| ADR  | Decision                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------- |
| 0001 | TanStack Query owns server state; Server Components only prefetch into it                      |
| 0002 | Supabase Auth for identity; authorization in the data-access layer (amended by 0007)           |
| 0003 | Route Handlers are the only client-to-server transport; zod schemas are the contract           |
| 0005 | The profile id is the Supabase auth user id (amended by 0008)                                  |
| 0006 | Sample data sits behind the real data path, until the connector supplies real leads            |
| 0007 | The packet is built on this repo: Next 16, pnpm, RLS default-deny with guards                  |
| 0008 | Google sign-in for provisioned `@authoritysolutions.com` staff only                            |
| 0009 | GoHighLevel is the record; the app keeps a synced copy and writes back through one logged path |

ADR-0004 (open sign-up) is superseded by 0008.

## Open questions, by who answers

**Lee**

1. The dev location: its Private Integration Token, ids, and the four outbound webhooks (06).
2. Who moves leads on silence, and the thresholds (14). Assumed: GHL moves them, the app mirrors.
3. The proposal link contact field (06, 12).
4. Which workflow fires when the app writes Qualified, Proposal Sent or Lead Won, so no client gets two emails (06, 13).
5. That Typeform submissions reach GHL as the Get Started form (06, 08).
6. Re-verify the two calendar ids; the calendar embed for the deck's last slide (06, 09).
7. Which Lead Status values a rep may set by hand from the app (07, 14).

**Zachery** 8. Approval of the stack deviations (ADR-0007) and the Vantage tag to pin (the packet names v6.11.0; the newest tag is v6.7.6). 9. Supabase org and Vercel team access; OpenRouter and Inngest accounts. 10. Smart Pricing Table credentials and template id; whether its beta API sends a signature webhook (12, 13). 11. The Invoice Ninja date-logic verdict and access (13). 12. Research sources for the brief, and who pays for any data provider (07).

**Zachery and Mitchell** 13. Which of GHL's 16 internal alerts become notification types (15). 14. A Fathom integration user with all-teams view access, and transcript retention (11). 15. The enhanced Presenton templates (09).

**Mitchell** 16. Invoice approver: admin only, as assumed (13). 17. Verdict thresholds, once the export numbers are in (08).

**Bien** 18. The Typeform historical export (08), once someone grants Typeform access. 19. The Render deployment of Presenton (09). 20. The five Fathom checks on a real account (11).

## Research

Primary-source notes the specs rely on are in `docs/research/`: Fathom's API (`fathom-api.md`) and Presenton on Render (`presenton-on-render.md`).
