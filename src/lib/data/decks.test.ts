// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET as getPdfRoute } from "@/app/api/decks/[leadId]/pdf/route";
import { GET as getDeckRoute } from "@/app/api/decks/[leadId]/route";
import { PATCH as patchSlideRoute } from "@/app/api/decks/[leadId]/slides/[slideId]/route";
import { GET as getSlotsRoute } from "@/app/api/decks/[leadId]/slots/route";
import { POST as postTemplateRoute } from "@/app/api/decks/[leadId]/template/route";
import { GET as getDecksRoute } from "@/app/api/decks/route";
import {
  getBookingSlots,
  getDeck,
  listDecks,
  switchTemplate,
  updateSlide,
} from "@/lib/data/decks";
import { buildSampleDecks, seedDeck } from "@/lib/data/fixtures/decks";
import { getLead, listVisibleLeads, resetSampleLeads } from "@/lib/data/leads";
import { PREVIEW_ROLE_COOKIE } from "@/lib/data/viewer";
import { DECK_TEMPLATE_LABEL } from "@/lib/decks/rules";
import {
  bookingSlotSchema,
  DECK_TEMPLATES,
  type Deck,
  deckListItemSchema,
  deckSchema,
  parseDeckAddress,
  slideFormSchema,
} from "@/lib/decks/schemas";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);

const ORIGIN = "http://localhost:3000";
const NOW = new Date("2026-10-07T12:00:00.000Z");
const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  resetFakes();
  resetSampleLeads();
  signIn();
  fake.users.set(ada.id, ada);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("the deck mock must make no network call");
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const viewAs = (role: string) => fake.cookies.set(PREVIEW_ROLE_COOKIE, role);
const refusedWith = (code: string) => expect.objectContaining({ code });

/** The id of the sample lead with this name. Asked as an owner, who sees every lead. */
async function idOf(name: string) {
  const role = fake.cookies.get(PREVIEW_ROLE_COOKIE);
  fake.cookies.delete(PREVIEW_ROLE_COOKIE);
  const lead = (await listVisibleLeads()).find((item) => item.name === name);
  if (role) fake.cookies.set(PREVIEW_ROLE_COOKIE, role);
  if (!lead) throw new Error(`no sample lead called ${name}`);
  return lead.id;
}
/** Maya's lead with a deck, Daniel's lead with a deck, and a lead with none. */
const MAYAS = "Hannah Kowalczyk";
const DANIELS = "Reuben Castellanos";
const NO_DECK = "Imogen Vasquez";

const context = <P>(params: P) => ({ params: Promise.resolve(params) });
const json = (method: string, path: string, body: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const TEXT = { heading: "A new heading", body: "", bullets: ["One", "Two"] };

const routes = {
  list: () => getDecksRoute(),
  deck: (leadId: string) =>
    getDeckRoute(
      new Request(`${ORIGIN}/api/decks/${leadId}`),
      context({ leadId }),
    ),
  slots: (leadId: string) =>
    getSlotsRoute(
      new Request(`${ORIGIN}/api/decks/${leadId}/slots`),
      context({ leadId }),
    ),
  pdf: (leadId: string) =>
    getPdfRoute(
      new Request(`${ORIGIN}/api/decks/${leadId}/pdf`),
      context({ leadId }),
    ),
  template: (leadId: string, body: unknown = { template: "review" }) =>
    postTemplateRoute(
      json("POST", `/api/decks/${leadId}/template`, body),
      context({ leadId }),
    ),
  slide: (leadId: string, slideId = "goals", body: unknown = TEXT) =>
    patchSlideRoute(
      json("PATCH", `/api/decks/${leadId}/slides/${slideId}`, body),
      context({ leadId, slideId }),
    ),
};
const everyRoute = (leadId: string): [string, () => Promise<Response>][] => [
  ["GET /api/decks", routes.list],
  ["GET /api/decks/{id}", () => routes.deck(leadId)],
  ["GET /api/decks/{id}/slots", () => routes.slots(leadId)],
  ["GET /api/decks/{id}/pdf", () => routes.pdf(leadId)],
  ["POST /api/decks/{id}/template", () => routes.template(leadId)],
  ["PATCH /api/decks/{id}/slides/{slide}", () => routes.slide(leadId)],
];

// --- refusals ----------------------------------------------------------------

test("signed out, every route answers 401, including the PDF", async () => {
  const leadId = await idOf(MAYAS);
  fake.claims = null;
  for (const [name, call] of everyRoute(leadId)) {
    const response = await call();
    expect(response.status, name).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated" },
    });
  }
});

test("signed in without a profile, every route answers 403 profile_required", async () => {
  const leadId = await idOf(MAYAS);
  fake.users.clear();
  for (const [name, call] of everyRoute(leadId)) {
    const response = await call();
    expect(response.status, name).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "profile_required" },
    });
  }
});

test("signed out, invalid input still answers 401: the guard comes before the input", async () => {
  const leadId = await idOf(MAYAS);
  fake.claims = null;
  expect((await routes.template(leadId, { template: "nope" })).status).toBe(
    401,
  );
  expect((await routes.slide(leadId, "goals", "not json")).status).toBe(401);
});

test("invalid input answers 400 and names the field", async () => {
  const leadId = await idOf(MAYAS);
  const cases: [string, Promise<Response>, string | null][] = [
    [
      "unknown template",
      routes.template(leadId, { template: "x" }),
      "template",
    ],
    ["not JSON", routes.template(leadId, "not json"), null],
    [
      "extra field",
      routes.template(leadId, { template: "review", a: 1 }),
      null,
    ],
    [
      "empty heading",
      routes.slide(leadId, "goals", { ...TEXT, heading: " " }),
      "heading",
    ],
    [
      "long body",
      routes.slide(leadId, "goals", { ...TEXT, body: "x".repeat(601) }),
      "body",
    ],
    [
      "too many points",
      routes.slide(leadId, "goals", { ...TEXT, bullets: Array(7).fill("a") }),
      "bullets",
    ],
    [
      "a field that is not text",
      routes.slide(leadId, "goals", { ...TEXT, kind: "title" }),
      null,
    ],
    ["not JSON", routes.slide(leadId, "goals", "not json"), null],
  ];
  for (const [name, call, field] of cases) {
    const response = await call;
    expect(response.status, name).toBe(400);
    const { error } = await response.json();
    expect(error.code, name).toBe("invalid_input");
    if (field) expect(error.fields[field], name).toBeTruthy();
  }
  // Nothing was written.
  expect((await getDeck(leadId)).template).toBe("discovery");
});

test("an unknown lead, a lead with no deck and an unknown slide answer 404", async () => {
  const withDeck = await idOf(MAYAS);
  const without = await idOf(NO_DECK);
  for (const leadId of ["lead-nope", without]) {
    for (const [name, call] of everyRoute(leadId).slice(1)) {
      const response = await call();
      expect(response.status, `${name} ${leadId}`).toBe(404);
      expect(await response.json()).toEqual({ error: { code: "not_found" } });
    }
  }
  expect((await routes.slide(withDeck, "no-such-slide")).status).toBe(404);
  // A slide of the other template is not in this deck.
  expect((await routes.slide(withDeck, "investment")).status).toBe(404);
});

// --- reads -------------------------------------------------------------------

test("the picker lists exactly the visible leads that have a deck, by name", async () => {
  const decks = await listDecks();
  const leads = await listVisibleLeads();
  expect(decks.map((deck) => deck.lead.id).sort()).toEqual(
    leads
      .filter((lead) => lead.deck)
      .map((lead) => lead.id)
      .sort(),
  );
  expect(decks.length).toBeGreaterThan(5);
  const names = decks.map((deck) => deck.lead.name);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  expect(names).not.toContain(NO_DECK);
  expect(await (await routes.list()).json()).toEqual(decks);
});

test("every sample deck parses against the contract, in both templates", async () => {
  expect(buildSampleDecks().size).toBe(0);
  expect(seedDeck("Discovery")).toEqual({ template: "discovery", edits: {} });
  expect(seedDeck("Something else").template).toBe("discovery");

  for (const item of await listDecks()) {
    expect(() => deckListItemSchema.parse(item)).not.toThrow();
    for (const template of DECK_TEMPLATES) {
      const deck = await switchTemplate(item.lead.id, { template });
      expect(() => deckSchema.parse(deck)).not.toThrow();
      expect(deck.template).toBe(template);
      expect(deck.pdfUrl).toBe(`/api/decks/${item.lead.id}/pdf`);
      // The first slide is the title; the booking calendar is on the last.
      expect(deck.slides[0].kind).toBe("title");
      expect(deck.slides.at(-1)?.kind).toBe("booking");
      expect(
        deck.slides.filter((slide) => slide.kind === "booking"),
      ).toHaveLength(1);
      expect(new Set(deck.slides.map((slide) => slide.id)).size).toBe(
        deck.slides.length,
      );
    }
  }
});

test("a deck is built from its lead, and never carries the deck service's id", async () => {
  const leadId = await idOf(MAYAS);
  const lead = await getLead(leadId);
  const deck = await getDeck(leadId);

  expect(deck.lead).toEqual({ id: leadId, name: MAYAS, company: lead.company });
  expect(deck.template).toBe("discovery");
  expect(deck.slides[0].heading).toBe(lead.company);
  expect(deck.slides[0].body).toContain(MAYAS);
  expect(deck.slides[1].bullets).toEqual(
    lead.formAnswers.map((answer) => answer.answer),
  );
  expect(JSON.stringify(deck)).not.toMatch(/presentation/i);
  expect(Object.keys(deck).sort()).toEqual([
    "lead",
    "pdfUrl",
    "slides",
    "template",
  ]);
  expect(await (await routes.deck(leadId)).json()).toEqual(deck);
  expect(fetch).not.toHaveBeenCalled();
});

test("call slots are sample times after now, on working days, and book nothing", async () => {
  const leadId = await idOf(MAYAS);
  const before = await getLead(leadId);
  const slots = await getBookingSlots(leadId);

  expect(slots.length).toBeGreaterThan(2);
  for (const slot of slots) {
    expect(() => bookingSlotSchema.parse(slot)).not.toThrow();
    expect(Date.parse(slot.time)).toBeGreaterThan(NOW.getTime());
    expect([0, 6]).not.toContain(new Date(slot.time).getUTCDay());
  }
  // 7 October 2026 is a Wednesday: the first sample day is the Thursday.
  expect(slots[0].time).toBe("2026-10-08T15:00:00.000Z");
  expect(await (await routes.slots(leadId)).json()).toEqual(slots);
  expect(await getLead(leadId)).toEqual(before);
});

// --- writes ------------------------------------------------------------------

test("an edit to a slide's text shows in a later read and changes nothing else", async () => {
  const leadId = await idOf(MAYAS);
  const before = await getDeck(leadId);

  const response = await routes.slide(leadId, "goals", {
    heading: "  What Hannah wants  ",
    body: "In her words.",
    bullets: ["More bookings", "  Fewer no-shows "],
  });
  expect(response.status).toBe(200);
  const after = (await response.json()) as Deck;
  expect(after).toEqual(await getDeck(leadId));

  const edited = after.slides.find((slide) => slide.id === "goals");
  expect(edited).toEqual({
    id: "goals",
    kind: "content",
    heading: "What Hannah wants",
    body: "In her words.",
    bullets: ["More bookings", "Fewer no-shows"],
  });
  expect(after.slides.filter((slide) => slide.id !== "goals")).toEqual(
    before.slides.filter((slide) => slide.id !== "goals"),
  );
  // Another lead's deck is untouched.
  const other = await getDeck(await idOf(DANIELS));
  expect(other.slides.find((slide) => slide.id === "goals")?.heading).toBe(
    "What you want to achieve",
  );
});

test("switching template redraws the deck, keeps edits to shared slides, and the lead follows", async () => {
  const leadId = await idOf(MAYAS);
  const discovery = await getDeck(leadId);
  await updateSlide(leadId, "goals", { ...TEXT, heading: "Shared edit" });
  await updateSlide(leadId, "budget", { ...TEXT, heading: "Discovery edit" });

  const response = await routes.template(leadId, { template: "review" });
  expect(response.status).toBe(200);
  const review = (await response.json()) as Deck;

  expect(review.template).toBe("review");
  expect(review.slides.map((slide) => slide.id)).not.toEqual(
    discovery.slides.map((slide) => slide.id),
  );
  expect(review.slides.find((slide) => slide.id === "goals")?.heading).toBe(
    "Shared edit",
  );
  expect(review.slides.some((slide) => slide.id === "budget")).toBe(false);

  // Lead detail and the timeline follow.
  const lead = await getLead(leadId);
  expect(lead.deck?.templateName).toBe(DECK_TEMPLATE_LABEL.review);
  expect(lead.activities[0]).toMatchObject({
    type: "Deck template changed",
    actor: { kind: "user", name: "Ada Lovelace" },
  });
  expect((await listDecks()).find((deck) => deck.lead.id === leadId)).toEqual(
    expect.objectContaining({ template: "review" }),
  );

  // Back again: the edit to the Discovery-only slide is still there.
  const back = await switchTemplate(leadId, { template: "discovery" });
  expect(back.slides.find((slide) => slide.id === "budget")?.heading).toBe(
    "Discovery edit",
  );
});

test("choosing the template a deck already has changes nothing", async () => {
  const leadId = await idOf(MAYAS);
  const before = await getLead(leadId);
  const deck = await switchTemplate(leadId, { template: "discovery" });
  expect(deck).toEqual(await getDeck(leadId));
  expect(await getLead(leadId)).toEqual(before);
});

// --- the PDF -----------------------------------------------------------------

test("the PDF route answers a PDF download named after the lead, one page per slide", async () => {
  const leadId = await idOf(MAYAS);
  await updateSlide(leadId, "goals", {
    heading: "Goals (so far) \\ café",
    body: "",
    bullets: [],
  });
  const deck = await getDeck(leadId);
  const response = await routes.pdf(leadId);

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(response.headers.get("Content-Disposition")).toBe(
    'attachment; filename="hannah-kowalczyk-deck.pdf"',
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(response.headers.get("Content-Length")).toBe(String(bytes.length));
  const text = new TextDecoder("latin1").decode(bytes);

  expect(text.startsWith("%PDF-")).toBe(true);
  expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  expect(text.match(/\/Type \/Page /g)).toHaveLength(deck.slides.length);
  expect(text).toContain(`/Count ${deck.slides.length}`);
  expect(text).toContain("Sample deck.");
  expect(text).toContain("(Kowalczyk Eye Care)");
  // The edit is in the file, with the characters PDF text needs escaped.
  expect(text).toContain("(Goals \\(so far\\) \\\\ caf?)");
  // The cross-reference table points at the objects.
  const xref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
  expect(text.slice(xref, xref + 4)).toBe("xref");
  const first = Number(
    /xref\n0 \d+\n\d{10} 65535 f \n(\d{10})/.exec(text)?.[1],
  );
  expect(text.slice(first, first + 7)).toBe("1 0 obj");
  expect(fetch).not.toHaveBeenCalled();
});

// --- roles -------------------------------------------------------------------

test("staff reach only their own leads' decks; another rep's deck answers not found", async () => {
  const mine = await idOf(MAYAS);
  const theirs = await idOf(DANIELS);
  viewAs("staff");

  const decks = await listDecks();
  expect(decks.length).toBeGreaterThan(0);
  const visible = (await listVisibleLeads()).map((lead) => lead.id);
  expect(decks.every((deck) => visible.includes(deck.lead.id))).toBe(true);
  expect(decks.map((deck) => deck.lead.id)).toContain(mine);
  expect(decks.map((deck) => deck.lead.id)).not.toContain(theirs);

  expect((await getDeck(mine)).lead.name).toBe(MAYAS);
  expect((await routes.pdf(mine)).status).toBe(200);

  await expect(getDeck(theirs)).rejects.toEqual(refusedWith("not_found"));
  for (const [name, call] of everyRoute(theirs).slice(1)) {
    expect((await call()).status, name).toBe(404);
  }

  // The refused writes changed nothing.
  viewAs("owner");
  const deck = await getDeck(theirs);
  expect(deck.template).toBe("discovery");
  expect(deck.slides.find((slide) => slide.id === "goals")?.heading).toBe(
    "What you want to achieve",
  );
});

test("an admin and an owner reach every deck", async () => {
  const theirs = await idOf(DANIELS);
  for (const role of ["admin", "owner"]) {
    viewAs(role);
    expect((await getDeck(theirs)).lead.name).toBe(DANIELS);
  }
});

// --- the contract's two readers ----------------------------------------------

test("the address gives the lead and the slide, and forgives a bad slide number", () => {
  expect(parseDeckAddress({})).toEqual({ lead: undefined, slide: 1 });
  expect(parseDeckAddress({ lead: "lead-17", slide: "3" })).toEqual({
    lead: "lead-17",
    slide: 3,
  });
  for (const slide of ["0", "-2", "abc", "2.5", ["1", "2"]]) {
    expect(parseDeckAddress({ lead: "lead-17", slide }).slide).toBe(1);
  }
  expect(parseDeckAddress({ lead: ["a", "b"] }).lead).toBeUndefined();
  expect(parseDeckAddress({ lead: " " }).lead).toBeUndefined();
});

test("the edit form's text becomes the route's input: one point per line", () => {
  expect(
    slideFormSchema.parse({
      heading: " Heading ",
      body: "",
      bullets: "One\n\n  Two  \n",
    }),
  ).toEqual({ heading: "Heading", body: "", bullets: ["One", "Two"] });
  expect(slideFormSchema.safeParse({ heading: "", bullets: "" }).success).toBe(
    false,
  );
});
