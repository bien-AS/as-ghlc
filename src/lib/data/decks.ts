import {
  buildSampleDecks,
  type DeckRecord,
  seedDeck,
} from "@/lib/data/fixtures/decks";
import {
  getLead,
  listVisibleLeads,
  recordDeckTemplate,
} from "@/lib/data/leads";
import { sampleStore } from "@/lib/data/sample";
import { AccessError } from "@/lib/data/users";
import { DECK_TEMPLATE_LABEL } from "@/lib/decks/rules";
import type {
  BookingSlot,
  Deck,
  DeckListItem,
  SwitchTemplateInput,
  UpdateSlideInput,
} from "@/lib/decks/schemas";
import type { LeadDetail } from "@/lib/leads/schemas";
import { listCallSlots } from "@/lib/services/booking-calendar";
import { exportPdf, generateSlides } from "@/lib/services/deck-service";

/*
 * Data access for decks (spec 13, blocked on question 2; ADR-0006).
 *
 * THE SEAM. Every exported function starts with the guard and then reads or
 * changes the sample store. The guard is the lead's: each function reaches the
 * lead through `getLead` or `listVisibleLeads` (which call `getViewer`), so a
 * signed-out caller is refused and staff reach only their own leads' decks;
 * another rep's lead answers `not_found`. Going live means replacing the
 * bodies of the exported functions below with queries on the Deck table and
 * calls to the deck service, and deleting `fixtures/`. Schemas, Route
 * Handlers, query options, hooks and components do not change.
 *
 * This is the only module, with its tests, that imports the deck fixtures, and
 * the only caller of the deck service and the booking calendar.
 */

const records = sampleStore("decks", buildSampleDecks);

/** The lead and its deck's row. A lead with no deck answers `not_found`. */
async function find(
  leadId: string,
): Promise<{ lead: LeadDetail; record: DeckRecord }> {
  // The guard: who is asking, and whether this lead is theirs to see.
  const lead = await getLead(leadId);
  if (!lead.deck) throw new AccessError("not_found");

  let record = records().get(lead.id);
  if (!record) {
    record = seedDeck(lead.deck.templateName);
    records().set(lead.id, record);
  }
  return { lead, record };
}

const pdfUrl = (leadId: string) =>
  `/api/decks/${encodeURIComponent(leadId)}/pdf`;

async function toDeck(lead: LeadDetail, record: DeckRecord): Promise<Deck> {
  const slides = await generateSlides(lead, record.template);
  return structuredClone({
    lead: { id: lead.id, name: lead.name, company: lead.company },
    template: record.template,
    slides: slides.map((slide) => ({ ...slide, ...record.edits[slide.id] })),
    pdfUrl: pdfUrl(lead.id),
  });
}

// ---------------------------------------------------------------------------
// The functions whose bodies change when real data arrives.
// ---------------------------------------------------------------------------

/** The leads the viewer may see that have a deck, by name: the picker. */
export async function listDecks(): Promise<DeckListItem[]> {
  const leads = await listVisibleLeads();
  return leads
    .flatMap((lead) =>
      lead.deck
        ? [
            {
              lead: { id: lead.id, name: lead.name, company: lead.company },
              template: (
                records().get(lead.id) ?? seedDeck(lead.deck.templateName)
              ).template,
            },
          ]
        : [],
    )
    .sort((a, b) => a.lead.name.localeCompare(b.lead.name));
}

/** One lead's deck, with its slides in order. */
export async function getDeck(leadId: string): Promise<Deck> {
  const { lead, record } = await find(leadId);
  return toDeck(lead, record);
}

/** Changes one slide's text. Nothing else about a slide can change. */
export async function updateSlide(
  leadId: string,
  slideId: string,
  input: UpdateSlideInput,
): Promise<Deck> {
  const { lead, record } = await find(leadId);
  const slides = await generateSlides(lead, record.template);
  if (!slides.some((slide) => slide.id === slideId)) {
    throw new AccessError("not_found");
  }
  record.edits[slideId] = input;
  return toDeck(lead, record);
}

/**
 * Draws the deck in another template. The lead's record and timeline follow
 * (spec 13, "Hands on to"). Choosing the template it already has changes nothing.
 */
export async function switchTemplate(
  leadId: string,
  input: SwitchTemplateInput,
): Promise<Deck> {
  const { lead, record } = await find(leadId);
  if (record.template !== input.template) {
    await recordDeckTemplate(lead.id, DECK_TEMPLATE_LABEL[input.template]);
    record.template = input.template;
  }
  return toDeck(lead, record);
}

/** The call slots offered on the deck's last slide. Nothing is booked. */
export async function getBookingSlots(leadId: string): Promise<BookingSlot[]> {
  await find(leadId);
  return listCallSlots(Date.now());
}

/** The deck as a PDF file, named after the lead. */
export async function getDeckPdf(
  leadId: string,
): Promise<{ filename: string; bytes: Uint8Array<ArrayBuffer> }> {
  const { lead, record } = await find(leadId);
  const deck = await toDeck(lead, record);
  const slug = lead.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    filename: `${slug || "lead"}-deck.pdf`,
    bytes: await exportPdf({
      leadName: lead.name,
      templateName: DECK_TEMPLATE_LABEL[deck.template],
      slides: deck.slides,
    }),
  };
}
