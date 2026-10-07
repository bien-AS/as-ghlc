"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { Deck, DeckTemplate, UpdateSlideInput } from "@/lib/decks/schemas";
import {
  deckListOptions,
  deckOptions,
  deckSlotsOptions,
} from "@/lib/queries/decks";
import { leadKeys, leadOptions } from "@/lib/queries/leads";

/*
 * Every client call for decks lives here (ADR-0001). Reads and writes go
 * through the Route Handlers under /api/decks; nothing here knows the slides
 * are sample data (ADR-0006).
 */

export function useDecks() {
  return useQuery(deckListOptions);
}

export function useDeck(leadId: string | undefined) {
  return useQuery({
    ...deckOptions(leadId ?? ""),
    enabled: Boolean(leadId),
    // A deck that does not exist will not start existing on a second try.
    retry: false,
  });
}

export function useDeckSlots(leadId: string | undefined) {
  return useQuery({
    ...deckSlotsOptions(leadId ?? ""),
    enabled: Boolean(leadId),
  });
}

/** Saves one slide's text. The answer is the whole deck, which replaces the cached one. */
export function useUpdateSlide(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slideId,
      input,
    }: {
      slideId: string;
      input: UpdateSlideInput;
    }) =>
      apiFetch<Deck>(
        `/api/decks/${encodeURIComponent(leadId)}/slides/${encodeURIComponent(slideId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    onSuccess: (deck) => {
      queryClient.setQueryData(deckOptions(leadId).queryKey, deck);
    },
  });
}

/** Draws the deck in another template. Lead detail and the lists follow. */
export function useSwitchTemplate(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (template: DeckTemplate) =>
      apiFetch<Deck>(`/api/decks/${encodeURIComponent(leadId)}/template`, {
        method: "POST",
        body: JSON.stringify({ template }),
      }),
    onSuccess: (deck) => {
      queryClient.setQueryData(deckOptions(leadId).queryKey, deck);
    },
    onSettled: () => {
      // The lead's deck template and timeline changed with it.
      void queryClient.invalidateQueries({
        queryKey: leadOptions(leadId).queryKey,
      });
      void queryClient.invalidateQueries({ queryKey: leadKeys.lists });
      void queryClient.invalidateQueries({
        queryKey: deckListOptions.queryKey,
      });
    },
  });
}
