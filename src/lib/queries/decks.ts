import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { BookingSlot, Deck, DeckListItem } from "@/lib/decks/schemas";

/*
 * One factory per resource for the key and the options (ADR-0001). The deck
 * presenter page prefetches with these, overriding `queryFn` to call the
 * data-access function; the hooks in src/hooks/use-decks.ts read the same keys.
 */

const path = (leadId: string) => `/api/decks/${encodeURIComponent(leadId)}`;

/** The picker: the leads that have a deck. */
export const deckListOptions = queryOptions({
  queryKey: ["decks", "list"],
  queryFn: () => apiFetch<DeckListItem[]>("/api/decks"),
});

export const deckOptions = (leadId: string) =>
  queryOptions({
    queryKey: ["decks", "detail", leadId],
    queryFn: () => apiFetch<Deck>(path(leadId)),
  });

/** The call slots offered on the last slide. */
export const deckSlotsOptions = (leadId: string) =>
  queryOptions({
    queryKey: ["decks", "slots", leadId],
    queryFn: () => apiFetch<BookingSlot[]>(`${path(leadId)}/slots`),
  });
