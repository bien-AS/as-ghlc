import { isServer, QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // ADR-0001: non-zero, or hydrated queries refetch at once and the server prefetch is wasted.
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * A fresh client per call on the server (never shared between requests); one
 * client for the life of the tab in the browser. Server Components that
 * prefetch call this too, then pass `dehydrate(client)` to <HydrationBoundary>.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
