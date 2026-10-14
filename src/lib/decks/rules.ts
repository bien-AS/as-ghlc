import type { DeckTemplate } from "@/lib/decks/schemas";

/*
 * Names and choices every deck screen and the data-access layer share. Pure;
 * no data access.
 */

/**
 * The three deck groups of the build packet: Discovery Call, Follow Up and
 * Strategy Session. The names are the packet's; the slides under each are
 * still invented (see deck-service.ts) until the real templates arrive.
 */
export const DECK_TEMPLATE_LABEL: Record<DeckTemplate, string> = {
  discovery_call: "Discovery Call",
  follow_up: "Follow Up",
  strategy_session: "Strategy Session",
};

/** The template a stored name refers to; an unknown name is the first template. */
export const templateFromLabel = (label: string): DeckTemplate =>
  (Object.keys(DECK_TEMPLATE_LABEL) as DeckTemplate[]).find(
    (template) => DECK_TEMPLATE_LABEL[template] === label,
  ) ?? "discovery_call";

/**
 * MOCK CHOICE (question 2, part 2: whose editor reps use; no assumed answer).
 * "ours": our own light text editing over slides drawn in the app. The other
 * answer, the deck service's embedded editor, replaces the Edit text control
 * with a way into that editor. This is not an answer to question 2.
 */
export const DECK_EDITOR: "ours" | "deck_service" = "ours";
