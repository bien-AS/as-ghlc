import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getBookingSlots, getDeck, listDecks } from "@/lib/data/decks";
import { getLead } from "@/lib/data/leads";
import { AccessError, enforceRoute } from "@/lib/data/users";
import { parseDeckAddress } from "@/lib/decks/schemas";
import {
  deckListOptions,
  deckOptions,
  deckSlotsOptions,
} from "@/lib/queries/decks";
import { leadOptions } from "@/lib/queries/leads";
import { getQueryClient } from "@/lib/query-client";

import { DeckScreen, type DeckScreenMissing } from "../_components/deck-screen";
import { DECK_PRESENTER_HREF, deckHref } from "../navigation";

export const metadata: Metadata = { title: "Deck presenter · Dealwright" };

const isNotFound = (error: unknown) =>
  error instanceof AccessError && error.code === "not_found";

/**
 * /dashboard/deck-presenter is the picker; with `?lead=<id>` it is that lead's
 * deck, and `&slide=<n>` is the slide on screen (spec 13).
 */
export default async function DeckPresenterPage({
  searchParams,
}: PageProps<"/dashboard/deck-presenter">) {
  // The address is the single source of which deck and which slide.
  const { lead: leadId } = parseDeckAddress(await searchParams);
  await enforceRoute(leadId ? deckHref(leadId) : DECK_PRESENTER_HREF);

  // ADR-0001: prefetch through the data-access functions, never over HTTP. A
  // failure other than "not found" is left for the client hook, which shows
  // the error state with a retry.
  const queryClient = getQueryClient();
  let missing: DeckScreenMissing;
  if (!leadId) {
    await queryClient.prefetchQuery({
      ...deckListOptions,
      queryFn: () => listDecks(),
    });
  } else {
    try {
      await queryClient.fetchQuery({
        ...leadOptions(leadId),
        queryFn: () => getLead(leadId),
      });
      try {
        await queryClient.fetchQuery({
          ...deckOptions(leadId),
          queryFn: () => getDeck(leadId),
        });
        await queryClient.prefetchQuery({
          ...deckSlotsOptions(leadId),
          queryFn: () => getBookingSlots(leadId),
        });
      } catch (error) {
        // The lead is there and has no deck: a state of its own.
        if (isNotFound(error)) missing = "deck";
      }
    } catch (error) {
      if (isNotFound(error)) missing = "lead";
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DeckScreen missing={missing} />
    </HydrationBoundary>
  );
}
