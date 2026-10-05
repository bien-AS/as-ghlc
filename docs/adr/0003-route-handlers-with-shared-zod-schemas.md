---
status: accepted
---

# Route Handlers are the only client-to-server transport; zod schemas are the contract

Client hooks reach the server through Route Handlers under `/api` for both reads and writes; we do not use Server Actions for mutations. Client-side refetching needs HTTP endpoints anyway, so adding Server Actions would give us two transports to authorize, validate and test. Each resource has one set of zod schemas that the handler parses input with and from which the hook's and form's types are inferred.

## Consequences

- Handlers stay thin: parse with zod, call the data-access function (which authorizes, ADR-0002), return JSON.
- Responses are not re-parsed on the client. We own both ends, so the inferred types are trusted; revisit if a third party ever consumes the API.
- Schemas must stay free of server-only imports so client code can import them.
