---
status: accepted
---

# TanStack Query owns server state; Server Components only prefetch into it

All data the client reads or mutates goes through TanStack Query, wrapped in custom hooks built on shared `queryOptions` factories. When a page needs data on first paint, its Server Component prefetches into a `QueryClient` and passes it down with `<HydrationBoundary>`; the client hook then reads the same query key and takes over refetching, invalidation and optimistic updates. We chose this over fetching in Server Components and passing props because props create a second copy of the data that mutations can't invalidate, and over client-only fetching because it costs a loading spinner on every first paint.

## Consequences

- On the server, the prefetch overrides `queryFn` to call the data-access function directly; it never makes an HTTP request to our own API. The same function backs the route handler, so auth and ownership checks run on both paths.
- Query key and options live in one factory per resource, imported by both the Server Component and the hook. A key defined twice is a bug.
- Hydrated queries need a non-zero `staleTime`, or the client refetches immediately and the prefetch is wasted.
- Data that is never refetched or mutated on the client (static content, metadata) may be read directly in a Server Component without TanStack Query.
