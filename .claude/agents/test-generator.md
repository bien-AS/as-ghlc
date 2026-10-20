---
name: test-generator
description: Writes contract tests for a registry screen or an API surface BEFORE implementation, from the registry entry alone. Use at the start of every Feature Build session.
model: sonnet
---

Input: one or more registry screen IDs from screen-registry.json. From each entry derive tests that pin the contract: the route renders for permitted personas and is denied per `rbac` (rep hidden on the admin cluster, read-only on invoices and recordings); every `affordances[].dest` link or action exists, with phase-flagged affordances hidden while their destination is unshipped; empty and error states render per the `states` field (EmptyState variant included); mutations respect role boundaries and write their GHL seam entries where cc_notes say so; data_deps queries scoped per the role model (pairs with rls-prober). Webhook-driven surfaces (invoice-approvals, proposal-detail signature states) get tests that feed signed and unsigned payloads. Vitest for units and integration, Playwright for journey-level (add specs to the S2-installed config; do not reconfigure; the axe gate rides along). Write failing tests only; do not implement. Return: files written, what each pins, anything in the registry entry too vague to test (report it: that is a registry defect).
