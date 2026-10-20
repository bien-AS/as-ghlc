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
import { getLead, listVisibleLeads } from "@/lib/data/leads";
import { resetSampleData } from "@/lib/data/sample";
import {
  bookingSlotSchema,
  type Deck,
  deckListItemSchema,
  deckSchema,
  parseDeckAddress,
  slideFormSchema,
} from "@/lib/decks/schemas";
import { resetStandIns, standIns } from "@/test/mockup-stand-ins";
import { fake, resetFakes, signIn, viewAs } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);
// Leads live in Postgres; the deck module reaches them only through these.
vi.mock("@/lib/data/leads", async (original) => ({
  ...(await original<typeof import("@/lib/data/leads")>()),
  ...(await import("@/test/mockup-stand-ins")).mockupLeadsModule,
}));

const ORIGIN = "http://localhost:3000";
const NOW = new Date("2026-10-07T12:00:00.000Z");
const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

/*
 * A real lead has no deck until decks are read from their table (spec 09), so
 * the deck module's own sample decks are reached through stand-ins given one:
 * the sample rep's Stand-in 1 and another rep's Stand-in 3. Stand-in 5 has none.
 */
const MAYAS = "stand-in-1";
const DANIELS = "stand-in-3";
const NO_DECK = "stand-in-5";
const ANSWERS = [
  { question: "What do you want to achieve?", answer: "More bookings" },
  { question: "What is in the way?", answer: "No-shows" },
];
function giveDecks() {
  for (const id of [MAYAS, DANIELS]) {
    standIns.patch.set(id, {
      deck: {
        templateName: "Discovery",
        viewUrl: "https://decks.example/view",
        pdfUrl: "https://decks.example/pdf",
      },
      formAnswers: ANSWERS,
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  resetFakes();
  resetSampleData();
  resetStandIns();
  giveDecks();
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

const refusedWith = (code: string) => expect.objectContaining({ code });

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
  fake.claims = null;
  for (const [name, call] of everyRoute(MAYAS)) {
    const response = await call();
    expect(response.status, name).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated" },
    });
  }
});

test("signed in without a profile, every route answers 403 profile_required", async () => {
  fake.users.clear();
  for (const [name, call] of everyRoute(MAYAS)) {
    const response = await call();
    expect(response.status, name).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "profile_required" },
    });
  }
});

test("signed out, invalid input still answers 401: the guard comes before the input", async () => {
  fake.claims = null;
  expect((await routes.template(MAYAS, { template: "nope" })).status).toBe(401);
  expect((await routes.slide(MAYAS, "goals", "not json")).status).toBe(401);
});

test("invalid input answers 400 and names the field", async () => {
  const leadId = MAYAS;
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
  for (const leadId of ["lead-nope", NO_DECK]) {
    for (const [name, call] of everyRoute(leadId).slice(1)) {
      const response = await call();
      expect(response.status, `${name} ${leadId}`).toBe(404);
      expect(await response.json()).toEqual({ error: { code: "not_found" } });
    }
  }
  expect((await routes.slide(MAYAS, "no-such-slide")).status).toBe(404);
  // A slide of the other template is not in this deck.
  expect((await routes.slide(MAYAS, "investment")).status).toBe(404);
});

test("with real leads, none of which has a deck yet, the picker is empty and every deck answers 404", async () => {
  resetStandIns();
  expect(await listDecks()).toEqual([]);
  expect(await (await routes.list()).json()).toEqual([]);
  for (const [name, call] of everyRoute(MAYAS).slice(1)) {
    expect((await call()).status, name).toBe(404);
  }
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
  const names = decks.map((deck) => deck.lead.name);
  expect(names).toEqual(["Stand-in 1", "Stand-in 3"]);
  expect(await (await routes.list()).json()).toEqual(decks);
});

test("every sample deck parses against the contract", async () => {
  expect(buildSampleDecks().size).toBe(0);
  expect(seedDeck("Discovery")).toEqual({ template: "discovery", edits: {} });
  expect(seedDeck("Something else").template).toBe("discovery");

  for (const item of await listDecks()) {
    expect(() => deckListItemSchema.parse(item)).not.toThrow();
    const deck = await getDeck(item.lead.id);
    expect(() => deckSchema.parse(deck)).not.toThrow();
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
});

test("a deck is built from its lead, and never carries the deck service's id", async () => {
  const lead = await getLead(MAYAS);
  const deck = await getDeck(MAYAS);

  expect(deck.lead).toEqual({
    id: MAYAS,
    name: "Stand-in 1",
    company: lead.company,
  });
  expect(deck.template).toBe("discovery");
  expect(deck.slides[0].heading).toBe(lead.company);
  expect(deck.slides[0].body).toContain("Stand-in 1");
  expect(deck.slides[1].bullets).toEqual(
    ANSWERS.map((answer) => answer.answer),
  );
  expect(JSON.stringify(deck)).not.toMatch(/presentation/i);
  expect(Object.keys(deck).sort()).toEqual([
    "lead",
    "pdfUrl",
    "slides",
    "template",
  ]);
  expect(await (await routes.deck(MAYAS)).json()).toEqual(deck);
  expect(fetch).not.toHaveBeenCalled();
});

test("call slots are sample times after now, on working days, and book nothing", async () => {
  const before = await getLead(MAYAS);
  const slots = await getBookingSlots(MAYAS);

  expect(slots.length).toBeGreaterThan(2);
  for (const slot of slots) {
    expect(() => bookingSlotSchema.parse(slot)).not.toThrow();
    expect(Date.parse(slot.time)).toBeGreaterThan(NOW.getTime());
    expect([0, 6]).not.toContain(new Date(slot.time).getUTCDay());
  }
  // 7 October 2026 is a Wednesday: the first sample day is the Thursday.
  expect(slots[0].time).toBe("2026-10-08T15:00:00.000Z");
  expect(await (await routes.slots(MAYAS)).json()).toEqual(slots);
  expect(await getLead(MAYAS)).toEqual(before);
});

// --- writes ------------------------------------------------------------------

test("an edit to a slide's text shows in a later read and changes nothing else", async () => {
  const before = await getDeck(MAYAS);

  const response = await routes.slide(MAYAS, "goals", {
    heading: "  What they want  ",
    body: "In their words.",
    bullets: ["More bookings", "  Fewer no-shows "],
  });
  expect(response.status).toBe(200);
  const after = (await response.json()) as Deck;
  expect(after).toEqual(await getDeck(MAYAS));

  const edited = after.slides.find((slide) => slide.id === "goals");
  expect(edited).toEqual({
    id: "goals",
    kind: "content",
    heading: "What they want",
    body: "In their words.",
    bullets: ["More bookings", "Fewer no-shows"],
  });
  expect(after.slides.filter((slide) => slide.id !== "goals")).toEqual(
    before.slides.filter((slide) => slide.id !== "goals"),
  );
  // Another lead's deck is untouched.
  const other = await getDeck(DANIELS);
  expect(other.slides.find((slide) => slide.id === "goals")?.heading).toBe(
    "What you want to achieve",
  );
});

test("switching template is refused until decks have their own table, and the deck is unchanged", async () => {
  await updateSlide(MAYAS, "goals", { ...TEXT, heading: "Shared edit" });
  const before = await getDeck(MAYAS);

  // The lead's record cannot follow yet (recordDeckTemplate), so nothing moves.
  const response = await routes.template(MAYAS, { template: "review" });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: { code: "conflict" } });
  await expect(switchTemplate(MAYAS, { template: "review" })).rejects.toEqual(
    refusedWith("conflict"),
  );
  expect(await getDeck(MAYAS)).toEqual(before);
});

test("choosing the template a deck already has changes nothing", async () => {
  const before = await getLead(MAYAS);
  const deck = await switchTemplate(MAYAS, { template: "discovery" });
  expect(deck).toEqual(await getDeck(MAYAS));
  expect(await getLead(MAYAS)).toEqual(before);
});

// --- the PDF -----------------------------------------------------------------

test("the PDF route answers a PDF download named after the lead, one page per slide", async () => {
  await updateSlide(MAYAS, "goals", {
    heading: "Goals (so far) \\ café",
    body: "",
    bullets: [],
  });
  const deck = await getDeck(MAYAS);
  const response = await routes.pdf(MAYAS);

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(response.headers.get("Content-Disposition")).toBe(
    'attachment; filename="stand-in-1-deck.pdf"',
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(response.headers.get("Content-Length")).toBe(String(bytes.length));
  const text = new TextDecoder("latin1").decode(bytes);

  expect(text.startsWith("%PDF-")).toBe(true);
  expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  expect(text.match(/\/Type \/Page /g)).toHaveLength(deck.slides.length);
  expect(text).toContain(`/Count ${deck.slides.length}`);
  expect(text).toContain("Sample deck.");
  expect(text).toContain("(Company 1)");
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

test("a rep reaches only their own leads' decks; another rep's deck answers not found", async () => {
  viewAs("rep");

  const decks = await listDecks();
  expect(decks.map((deck) => deck.lead.id)).toEqual([MAYAS]);

  expect((await getDeck(MAYAS)).lead.name).toBe("Stand-in 1");
  expect((await routes.pdf(MAYAS)).status).toBe(200);

  await expect(getDeck(DANIELS)).rejects.toEqual(refusedWith("not_found"));
  for (const [name, call] of everyRoute(DANIELS).slice(1)) {
    expect((await call()).status, name).toBe(404);
  }

  // The refused writes changed nothing.
  viewAs("admin");
  const deck = await getDeck(DANIELS);
  expect(deck.template).toBe("discovery");
  expect(deck.slides.find((slide) => slide.id === "goals")?.heading).toBe(
    "What you want to achieve",
  );
});

test("an admin reaches every deck", async () => {
  viewAs("admin");
  expect((await getDeck(DANIELS)).lead.name).toBe("Stand-in 3");
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
