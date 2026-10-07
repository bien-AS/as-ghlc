import { z } from "zod";

/*
 * The deck contract (spec 13, which is blocked on question 2 and stops at the
 * interface), shaped after the Deck row of spec 09's sketch. Shared by Route
 * Handlers, hooks, pages and the data-access layer (ADR-0003). Client-safe: no
 * server-only imports and no fixtures.
 *
 * The deck service's presentation id is deliberately absent: it stays on the
 * server. The PDF link points at our own route, never at the deck service.
 */

/** Spec 13: "at least two templates by purpose: discovery and review". */
export const DECK_TEMPLATES = ["discovery", "review"] as const;
export const deckTemplateSchema = z.enum(DECK_TEMPLATES);
export type DeckTemplate = z.infer<typeof deckTemplateSchema>;

/** "booking" is the last slide, where the booking calendar sits (spec 13). */
export const SLIDE_KINDS = ["title", "content", "booking"] as const;

export const SLIDE_HEADING_MAX = 120;
export const SLIDE_BODY_MAX = 600;
export const SLIDE_BULLETS_MAX = 6;
export const SLIDE_BULLET_MAX = 160;

export const slideSchema = z.object({
  /** Stable within a template. A slide two templates share has one id. */
  id: z.string(),
  kind: z.enum(SLIDE_KINDS),
  heading: z.string(),
  /** Empty when the slide has no running text. */
  body: z.string(),
  bullets: z.array(z.string()),
});
export type Slide = z.infer<typeof slideSchema>;

const deckLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
});

export const deckSchema = z.object({
  lead: deckLeadSchema,
  template: deckTemplateSchema,
  /** In presenting order. Never empty. */
  slides: z.array(slideSchema).min(1),
  /** Our own route (GET /api/decks/{leadId}/pdf). */
  pdfUrl: z.string(),
});
export type Deck = z.infer<typeof deckSchema>;

/** One row of the picker. */
export const deckListItemSchema = z.object({
  lead: deckLeadSchema,
  template: deckTemplateSchema,
});
export type DeckListItem = z.infer<typeof deckListItemSchema>;

/** A call slot offered on the last slide. */
export const bookingSlotSchema = z.object({
  id: z.string(),
  time: z.iso.datetime(),
  minutes: z.number().int().positive(),
});
export type BookingSlot = z.infer<typeof bookingSlotSchema>;

/** Body of PATCH /api/decks/{leadId}/slides/{slideId}. Text only. */
export const updateSlideInputSchema = z.strictObject({
  heading: z
    .string()
    .trim()
    .min(1, "Enter a heading.")
    .max(SLIDE_HEADING_MAX, `Use ${SLIDE_HEADING_MAX} characters or fewer.`),
  body: z
    .string()
    .trim()
    .max(SLIDE_BODY_MAX, `Use ${SLIDE_BODY_MAX} characters or fewer.`),
  bullets: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(
          SLIDE_BULLET_MAX,
          `Keep each point to ${SLIDE_BULLET_MAX} characters or fewer.`,
        ),
    )
    .max(SLIDE_BULLETS_MAX, `Use ${SLIDE_BULLETS_MAX} points or fewer.`),
});
export type UpdateSlideInput = z.infer<typeof updateSlideInputSchema>;

/**
 * The edit form's fields, as text: bullet points are one per line. Parses to
 * the same shape the route accepts.
 */
export const slideFormSchema = z
  .object({
    heading: z.string(),
    body: z.string().default(""),
    bullets: z
      .string()
      .default("")
      .transform((text) =>
        text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      ),
  })
  .pipe(updateSlideInputSchema);

/** Body of POST /api/decks/{leadId}/template. */
export const switchTemplateInputSchema = z.strictObject({
  template: deckTemplateSchema,
});
export type SwitchTemplateInput = z.infer<typeof switchTemplateInputSchema>;

/**
 * The presenter's place as it sits in the page address: which lead's deck, and
 * which slide (counted from 1). Lenient: a pasted link with a bad slide number
 * lands on the first slide. The server page and the client screen both read
 * the address through this (ADR-0001).
 */
const deckAddressSchema = z.object({
  lead: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value || undefined)
    .optional()
    .catch(undefined),
  slide: z.coerce.number().int().min(1).max(999).catch(1),
});
export type DeckAddress = z.infer<typeof deckAddressSchema>;

export function parseDeckAddress(address: Record<string, unknown>) {
  return deckAddressSchema.parse({ lead: address.lead, slide: address.slide });
}
