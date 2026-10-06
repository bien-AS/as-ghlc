---
status: accepted
---

# Sign-up is open to anyone for now

Anyone can create an ASCRM account with an email and password or with Google; there is no allowed-domain check and no invite. The spec handoff proposed the opposite (no public sign-up, access by a workspace's allowed email domain or an invite), but the owner expects ASCRM to become an open product, with any paywall added later, and does not want to build Workspace, membership and role models before the first screens exist. We chose the open door now and deferred the restriction, rather than building an invite system for a product whose customer model is still unscoped (open questions 7 and 9).

## Considered Options

- **Allowed domain or invite per Workspace** (the handoff's proposal). Rejected for now: it needs Workspace and membership models that are not being built yet. It is kept as the deferred rule in the users, roles and workspace access spec.
- **Closed sign-up with accounts created by hand.** Rejected: it does not match the direction of an open product.

## Consequences

- Until roles and Workspace membership exist, every authenticated user sees everything in the dashboard. That is acceptable only while the dashboard shows sample data. Real lead data must not be connected before the access model in the users, roles and workspace access spec is built; open sign-up plus a single shared view would expose every lead to anyone with an email address.
- Email confirmation stays on, so an account still proves control of a mailbox.
- Reversing this means adding a gate at sign-up and at profile setup (domain, invite or payment) and deciding what happens to accounts that already exist. Answers to questions 7 and 9, or the arrival of a paywall, are what would trigger it.
