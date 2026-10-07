import type { DeckTemplate } from "@/lib/decks/schemas";

/*
 * Names and choices every deck screen and the data-access layer share. Pure;
 * no data access.
 */

/**
 * ASSUMED (spec 13, "The deck templates": not supplied). Two templates by
 * purpose, named after it. The real names arrive with the templates; change
 * them here. The lead fixtures already call a sample deck's template
 * "Discovery".
 */
export const DECK_TEMPLATE_LABEL: Record<DeckTemplate, string> = {
  discovery: "Discovery",
  review: "Review",
};

/** The template a stored name refers to; an unknown name is the first template. */
export const templateFromLabel = (label: string): DeckTemplate =>
  (Object.keys(DECK_TEMPLATE_LABEL) as DeckTemplate[]).find(
    (template) => DECK_TEMPLATE_LABEL[template] === label,
  ) ?? "discovery";

/**
 * MOCK CHOICE (question 2, part 2: whose editor reps use; no assumed answer).
 * "ours": our own light text editing over slides drawn in the app. The other
 * answer, the deck service's embedded editor, replaces the Edit text control
 * with a way into that editor. This is not an answer to question 2.
 */
export const DECK_EDITOR: "ours" | "deck_service" = "ours";
