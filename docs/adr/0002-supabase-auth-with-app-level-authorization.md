---
status: accepted
---

# Supabase Auth for identity; authorization in our data-access layer, not RLS

Supabase Auth issues and verifies sessions, but all data access goes through Prisma connected directly to the Supabase Postgres database. That connection uses a privileged role which bypasses Row Level Security, so RLS cannot protect us: every authorization check is application code. We accepted that in exchange for one typed query layer and migrations owned by Prisma, instead of splitting reads between Prisma and the Supabase client.

Resources are owned by a tenant, and users reach them through membership of that tenant. The shared guards (authenticated user, then membership of the owning tenant) run inside the data-access functions, not in a route-handler wrapper, because Server Components call those functions directly when prefetching (ADR-0001) and would otherwise skip the check.

## Consequences

- A data-access function without a guard is an open door; nothing underneath will catch it. Never export a query that takes a resource id without also resolving the caller.
- The Supabase client is used for auth only. Do not read or write application tables through it, and do not rely on RLS policies as the access model.
- Supabase owns the `auth` schema. Prisma models reference the auth user id but do not manage or migrate that schema.
- Verify the session with Supabase on the server for every request; never trust a user or tenant id sent by the client.
