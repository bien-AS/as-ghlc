---
status: accepted
---

# Sample data sits behind the real data path

The first dashboard screens (Pipeline, Lead detail, Suspect review) run on sample data, but they read and write it through the same path real data will use: components call custom TanStack Query hooks (ADR-0001), hooks call Route Handlers under `/api` that validate with shared zod schemas (ADR-0003), and handlers call data-access functions that run the auth guard first (ADR-0002). Only the bodies of those data-access functions know the data is fixtures. Going live means replacing those bodies with database queries and changing nothing above them; the zod schemas are the contract that must not move.

## Considered Options

- **Import fixtures straight into components.** Rejected: it is faster this week, but every screen would be rewritten when real data arrives, and loading, error and unauthenticated states would never be exercised until then.
- **Seed a real database with sample rows.** Rejected for now: it requires the Lead model and its neighbours, which depend on open questions 7 and 9.

## Consequences

- Fixtures are imported by data-access functions only. A fixture import anywhere else (a component, a hook, a Route Handler, a schema file) breaks the seam and is a bug.
- Fixtures must parse against the zod schemas, so the sample data cannot drift from the contract.
- Data-access functions are asynchronous and guarded from day one, even though fixtures need neither, so their signatures do not change when the bodies do.
- Writes made against sample data live in server memory only: they are lost on restart and are not shared between server instances. The dashboard labels the data as sample so nobody mistakes it for a record.
- The check for "going live touched only what it should": the change that swaps fixtures for the database modifies data-access function bodies and deletes the fixtures, and leaves schemas, Route Handlers, hooks and components untouched.
