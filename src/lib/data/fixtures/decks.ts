import { templateFromLabel } from "@/lib/decks/rules";
import type { DeckTemplate, UpdateSlideInput } from "@/lib/decks/schemas";

/*
 * Sample decks. Imported only by src/lib/data/decks.ts and its tests.
 *
 * A deck's row as the sample store keeps it: which template it uses and the
 * text a rep has changed, by slide id. The slides themselves come from the
 * deck service each time, so an edit to a slide two templates share is kept
 * when the template changes. Deleted with the rest of `fixtures/` when the
 * Deck table exists (spec 09).
 */
export type DeckRecord = {
  template: DeckTemplate;
  edits: Record<string, UpdateSlideInput>;
};

/** Every sample deck, by lead id. Empty: a lead's deck is seeded on first read. */
export const buildSampleDecks = () => new Map<string, DeckRecord>();

/** A lead's deck as it is before anyone touches it. */
export const seedDeck = (templateName: string): DeckRecord => ({
  template: templateFromLabel(templateName),
  edits: {},
});
