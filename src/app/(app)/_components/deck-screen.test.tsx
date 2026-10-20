import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getDeck } from "@/lib/data/decks";
import { getLead } from "@/lib/data/leads";
import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";
import { resetStandIns, standIns } from "@/test/mockup-stand-ins";
import { address, resetNavigation, router } from "@/test/navigation";

import { deckHref } from "../navigation";
import { DeckScreen, type DeckScreenMissing } from "./deck-screen";

/** The page: it hands the screen the lead id from the address, as the route does. */
function Page({ missing }: { missing?: DeckScreenMissing }) {
  return <DeckScreen leadId={usePathname().split("/")[2]} missing={missing} />;
}

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);
vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationModule,
);
vi.mock(
  "@/lib/navigate",
  async () => (await import("@/test/render")).navigateModule,
);
// Leads live in Postgres; the deck module reaches them only through these.
vi.mock("@/lib/data/leads", async (original) => ({
  ...(await original<typeof import("@/lib/data/leads")>()),
  ...(await import("@/test/mockup-stand-ins")).mockupLeadsModule,
}));

/*
 * A real lead has no deck until decks are read from their table (spec 09), so
 * the presenter's own sample decks are reached through stand-ins given one:
 * the sample rep's Stand-in 1 and another rep's Stand-in 3. Stand-in 5 has none.
 */
const MAYAS = "stand-in-1";
const DANIELS = "stand-in-3";
const NO_DECK = "stand-in-5";
const nameOf = (leadId: string) => `Stand-in ${leadId.split("-").at(-1)}`;
const SAMPLE_LINE =
  "Sample data: this stands in for the booking calendar. Nothing is booked.";

beforeEach(() => {
  startDashboard("/decks");
  resetStandIns();
  for (const id of [MAYAS, DANIELS]) {
    standIns.patch.set(id, {
      deck: {
        templateName: "Discovery",
        viewUrl: "https://decks.example/view",
        pdfUrl: "https://decks.example/pdf",
      },
      formAnswers: [
        { question: "What do you want to achieve?", answer: "More bookings" },
      ],
    });
  }
});
afterEach(() => {
  cleanup();
  stopDashboard();
});

/** Opens a lead's deck at an address, as the page would render it. */
function open(leadId: string, extra = "", missing?: DeckScreenMissing) {
  resetNavigation(`${deckHref(leadId)}${extra}`);
  renderScreen(<Page missing={missing} />);
  return leadId;
}
async function present(leadId: string, extra = "") {
  open(leadId, extra);
  await screen.findByRole("heading", {
    level: 1,
    name: `Deck for ${nameOf(leadId)}`,
  });
  return leadId;
}
const button = (name: string | RegExp) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const slide = () =>
  document.querySelector<HTMLElement>('[data-slot="slide-frame"]');
const slideHeading = () =>
  within(slide() as HTMLElement).getByRole("heading").textContent;
const counter = () => screen.getByRole("status").textContent;
const outline = () =>
  within(screen.getByRole("navigation", { name: "Slides" })).getAllByRole(
    "link",
  );

// --- the picker --------------------------------------------------------------

test("with no lead in the address, lists the leads that have a deck, each a link to its deck", async () => {
  renderScreen(<Page />);
  await screen.findByRole("heading", { level: 1, name: "Deck presenter" });

  const rows = await screen.findAllByRole("listitem");
  expect(rows).toHaveLength(2);
  const first = screen.getByRole("link", { name: /Stand-in 1/ });
  expect(first.getAttribute("href")).toBe(deckHref(MAYAS));
  expect(first.textContent).toContain("Company 1");
  expect(first.textContent).toContain("Discovery template");
  // A lead with no deck is not offered.
  expect(screen.queryByRole("link", { name: /Stand-in 5/ })).toBeNull();
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("the picker shows only a rep's own leads' decks", async () => {
  viewAs("rep");
  renderScreen(<Page />);
  await screen.findByRole("link", { name: /Stand-in 1/ });
  expect(screen.queryByRole("link", { name: /Stand-in 3/ })).toBeNull();
});

test("with real leads, none of which has a deck yet, the picker says so", async () => {
  resetStandIns();
  renderScreen(<Page />);
  await screen.findByText("No decks yet");
  screen.getByText(/Decks generate on their own for valid leads/);
  expect(
    screen
      .getByRole("link", { name: "Go to the Pipeline" })
      .getAttribute("href"),
  ).toBe("/leads");
});

test("the picker shows a skeleton while loading, and an error with Try again", async () => {
  api.fail("GET", /^\/api\/decks$/, 500, { once: true });
  const release = api.hold("GET", /^\/api\/decks$/);
  renderScreen(<Page />);
  screen.getByRole("status", { name: "Loading decks" });
  release();
  await screen.findByText("The decks could not be loaded");

  fireEvent.click(button("Try again"));
  await screen.findByRole("link", { name: /Stand-in 1/ });
});

// --- slides and the address --------------------------------------------------

test("shows the first slide, and Next and Previous move through the deck in the address", async () => {
  await present(MAYAS);
  const deck = await getDeck(MAYAS);

  expect(slideHeading()).toBe("Company 1");
  expect(slide()?.getAttribute("aria-label")).toBe("Slide 1 of 7: Company 1");
  expect(counter()).toBe("1 of 7");
  expect(button("Previous slide").disabled).toBe(true);
  expect(outline().map((link) => link.textContent)).toEqual(
    deck.slides.map((item, index) => `${index + 1}${item.heading}`),
  );
  expect(outline()[0].getAttribute("aria-current")).toBe("true");
  expect(outline()[2].getAttribute("href")).toBe(`${deckHref(MAYAS)}?slide=3`);

  fireEvent.click(button("Next slide"));
  await waitFor(() => expect(counter()).toBe("2 of 7"));
  expect(address()).toBe(`${deckHref(MAYAS)}?slide=2`);
  expect(slideHeading()).toBe("What you told us");
  expect(outline()[1].getAttribute("aria-current")).toBe("true");
  // Replaced, not pushed: Back leaves the deck.
  expect(router.push).not.toHaveBeenCalled();

  fireEvent.click(button("Previous slide"));
  await waitFor(() => expect(counter()).toBe("1 of 7"));
  // The first slide needs no number.
  expect(address()).toBe(deckHref(MAYAS));
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("the arrow keys move between slides, but not from inside a control that uses them", async () => {
  await present(MAYAS, "?slide=6");

  fireEvent.keyDown(document.body, { key: "ArrowRight" });
  await waitFor(() => expect(counter()).toBe("7 of 7"));
  expect(button("Next slide").disabled).toBe(true);
  // Nothing past the last slide.
  fireEvent.keyDown(document.body, { key: "ArrowRight" });
  expect(address()).toBe(`${deckHref(MAYAS)}?slide=7`);

  fireEvent.keyDown(document.body, { key: "ArrowLeft" });
  await waitFor(() => expect(counter()).toBe("6 of 7"));

  // The template select keeps its own arrow keys.
  fireEvent.keyDown(screen.getByLabelText("Template"), { key: "ArrowLeft" });
  fireEvent.keyDown(document.body, { key: "ArrowLeft", ctrlKey: true });
  expect(address()).toBe(`${deckHref(MAYAS)}?slide=6`);
});

test("a reload or a shared link lands on the slide in the address", async () => {
  await present(MAYAS, "?slide=3");
  expect(counter()).toBe("3 of 7");
  expect(slideHeading()).toBe("What you want to achieve");
});

test("a slide number past the end is the last slide; a bad one is the first", async () => {
  await present(MAYAS, "?slide=99");
  expect(counter()).toBe("7 of 7");
  cleanup();

  await present(MAYAS, "?slide=abc");
  expect(counter()).toBe("1 of 7");
});

// --- edit text ---------------------------------------------------------------

test("Edit text turns the slide's heading and text into fields; Save writes them and shows them on the slide", async () => {
  await present(MAYAS, "?slide=3");

  fireEvent.click(button("Edit text"));
  const form = screen.getByRole("form", { name: "Edit this slide's text" });
  const heading = within(form).getByLabelText<HTMLInputElement>("Heading");
  const points = within(form).getByLabelText<HTMLTextAreaElement>("Points");
  expect(heading.value).toBe("What you want to achieve");
  expect(document.activeElement).toBe(heading);
  expect(points.value.split("\n")).toHaveLength(3);
  expect(slide()).toBeNull();
  // While editing: no slide changes, and Save is the one main action.
  expect(button("Next slide").disabled).toBe(true);
  expect(button("Present full screen").disabled).toBe(true);
  fireEvent.keyDown(document.body, { key: "ArrowRight" });
  expect(address()).toBe(`${deckHref(MAYAS)}?slide=3`);

  // An empty heading is refused in place, before any request.
  fireEvent.change(heading, { target: { value: "  " } });
  fireEvent.click(button("Save"));
  await within(form).findByText("Enter a heading.");
  expect(heading.getAttribute("aria-invalid")).toBe("true");
  expect(api.calls().some((call) => call.startsWith("PATCH"))).toBe(false);

  fireEvent.change(heading, { target: { value: "What they want" } });
  expect(within(form).queryByText("Enter a heading.")).toBeNull();
  fireEvent.change(within(form).getByLabelText("Text"), {
    target: { value: "In their own words." },
  });
  fireEvent.change(points, {
    target: { value: "More bookings\n\nFewer no-shows" },
  });
  fireEvent.click(button("Save"));

  await screen.findByText("Slide saved");
  expect(slideHeading()).toBe("What they want");
  const drawn = within(slide() as HTMLElement);
  drawn.getByText("In their own words.");
  expect(
    drawn.getAllByRole("listitem").map((item) => item.textContent),
  ).toEqual(["More bookings", "Fewer no-shows"]);
  expect(outline()[2].textContent).toBe("3What they want");
  expect(api.calls()).toContain(`PATCH /api/decks/${MAYAS}/slides/goals`);
  // Stored, not only shown.
  expect((await getDeck(MAYAS)).slides[2].heading).toBe("What they want");
});

test("Cancel leaves the slide as it was; a failed save keeps the text and can be tried again", async () => {
  await present(MAYAS, "?slide=4");

  fireEvent.click(button("Edit text"));
  fireEvent.change(screen.getByLabelText("Heading"), {
    target: { value: "Thrown away" },
  });
  fireEvent.click(button("Cancel"));
  expect(slideHeading()).toBe("How we work");

  api.fail("PATCH", /\/slides\//, 500, { once: true });
  fireEvent.click(button("Edit text"));
  fireEvent.change(screen.getByLabelText("Heading"), {
    target: { value: "How we will work" },
  });
  fireEvent.click(button("Save"));
  await screen.findByText(/The slide was not saved/);
  expect(screen.getByLabelText<HTMLInputElement>("Heading").value).toBe(
    "How we will work",
  );
  expect((await getDeck(MAYAS)).slides[3].heading).toBe("How we work");

  fireEvent.click(button("Save"));
  await screen.findByText("Slide saved");
  expect(slideHeading()).toBe("How we will work");
});

// --- switch template ---------------------------------------------------------

test("until decks have their own table, a template change is refused: the screen says so and the deck and lead stay as they were", async () => {
  await present(MAYAS, "?slide=3");
  const select = screen.getByLabelText<HTMLSelectElement>("Template");
  expect(select.value).toBe("discovery");
  expect(
    within(select)
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(["Discovery", "Review"]);
  const before = outline().map((link) => link.textContent);

  fireEvent.change(select, { target: { value: "review" } });
  await screen.findByText(/The template could not be changed/);
  expect(api.calls()).toContain(`POST /api/decks/${MAYAS}/template`);
  expect(select.value).toBe("discovery");
  expect(outline().map((link) => link.textContent)).toEqual(before);
  expect(counter()).toBe("3 of 7");
  expect((await getLead(MAYAS)).deck?.templateName).toBe("Discovery");
});

test("a template change that fails says so and leaves the deck as it was", async () => {
  await present(MAYAS);
  api.fail("POST", /\/template$/, 500, { once: true });
  const select = screen.getByLabelText<HTMLSelectElement>("Template");

  fireEvent.change(select, { target: { value: "review" } });
  await screen.findByText(/The template could not be changed/);
  expect(select.value).toBe("discovery");
  expect(outline()[1].textContent).toBe("2What you told us");
});

// --- the last slide, the PDF -------------------------------------------------

test("the last slide carries the booking calendar stand-in: sample call times that cannot be chosen", async () => {
  await present(MAYAS, "?slide=6");
  expect(screen.queryByText(SAMPLE_LINE)).toBeNull();

  fireEvent.click(button("Next slide"));
  await waitFor(() => expect(counter()).toBe("7 of 7"));
  const drawn = within(slide() as HTMLElement);
  drawn.getByText(SAMPLE_LINE);
  const times = within(
    await drawn.findByRole("list", { name: "Sample call times" }),
  );
  await waitFor(() =>
    expect(times.getAllByRole("listitem").length).toBeGreaterThan(2),
  );
  // Inert: no control inside the slide, so nothing can be booked.
  expect(drawn.queryAllByRole("button")).toHaveLength(0);
  expect(drawn.queryAllByRole("link")).toHaveLength(0);
  expect(drawn.queryAllByRole("radio")).toHaveLength(0);
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("Download PDF is a link to our own route, and the screen says what is sample data", async () => {
  await present(MAYAS);
  const link = screen.getByRole("link", { name: "Download PDF" });
  expect(link.getAttribute("href")).toBe(`/api/decks/${MAYAS}/pdf`);
  expect(link.hasAttribute("download")).toBe(true);
  screen.getByText(/Sample data: these slides are examples/);
  expect(
    screen.getByRole("link", { name: "Open the lead" }).getAttribute("href"),
  ).toBe(`/leads/${MAYAS}`);
  // There is no way to generate a deck by hand (spec 13).
  expect(screen.queryByRole("button", { name: /generate/i })).toBeNull();
});

// --- full screen -------------------------------------------------------------

test("Present full screen asks the browser for full screen on the slide area, and follows the browser out of it", async () => {
  await present(MAYAS);
  let fullscreenElement: Element | null = null;
  const requestFullscreen = vi.fn(async function (this: Element) {
    fullscreenElement = this;
  });
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenElement,
  });
  Element.prototype.requestFullscreen = requestFullscreen;
  try {
    fireEvent.click(button("Present full screen"));
    await screen.findByRole("button", { name: "Exit full screen" });
    const stage = requestFullscreen.mock.contexts[0] as HTMLElement;
    // The slide and its controls go full screen together, and focus goes in.
    expect(stage.contains(slide())).toBe(true);
    expect(stage.contains(button("Next slide"))).toBe(true);
    expect(stage.contains(button("Exit full screen"))).toBe(true);
    expect(document.activeElement).toBe(stage);
    // Editing is not available while presenting.
    expect(button("Edit text").disabled).toBe(true);

    fireEvent.click(button("Next slide"));
    await waitFor(() => expect(counter()).toBe("2 of 7"));

    // Escape is the browser's: it leaves full screen and tells the page.
    fullscreenElement = null;
    fireEvent(document, new Event("fullscreenchange"));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Exit full screen" }),
      ).toBeNull(),
    );
    expect(document.activeElement).toBe(button("Present full screen"));
    expect(button("Edit text").disabled).toBe(false);
  } finally {
    Reflect.deleteProperty(document, "fullscreenEnabled");
    Reflect.deleteProperty(document, "fullscreenElement");
    Reflect.deleteProperty(Element.prototype, "requestFullscreen");
  }
});

test("where full screen is unavailable, presenting covers the window instead, and Escape or Exit leaves it", async () => {
  // jsdom has no Fullscreen API, like an embedded page that is refused it.
  await present(MAYAS);
  const stage = () => document.querySelector<HTMLElement>("[data-presenting]");
  expect(stage()).toBeNull();

  fireEvent.click(button("Present full screen"));
  await screen.findByRole("button", { name: "Exit full screen" });
  expect(stage()?.contains(slide())).toBe(true);
  expect(document.activeElement).toBe(stage());

  fireEvent.keyDown(document.body, { key: "ArrowRight" });
  await waitFor(() => expect(counter()).toBe("2 of 7"));

  fireEvent.keyDown(document.body, { key: "Escape" });
  await waitFor(() => expect(stage()).toBeNull());
  expect(document.activeElement).toBe(button("Present full screen"));

  fireEvent.click(button("Present full screen"));
  fireEvent.click(
    await screen.findByRole("button", { name: "Exit full screen" }),
  );
  await waitFor(() => expect(stage()).toBeNull());
});

// --- states ------------------------------------------------------------------

test("shows a skeleton while the deck loads, then an error with Try again", async () => {
  api.fail("GET", /^\/api\/decks\/[^/]+$/, 500, { once: true });
  const release = api.hold("GET", /^\/api\/decks\/[^/]+$/);
  open(MAYAS);
  screen.getByRole("status", { name: "Loading deck" });
  release();
  await screen.findByText("This deck could not be loaded");

  fireEvent.click(button("Try again"));
  await screen.findByRole("heading", { level: 1, name: "Deck for Stand-in 1" });
});

test("an unknown lead is a state of its own, whether the server or the browser finds out", async () => {
  resetNavigation("/decks/lead-nope");
  renderScreen(<Page />);
  await screen.findByText("This lead does not exist");
  // The deck library is not built: no link to it (spec 01, phase flags).
  expect(screen.queryByRole("link", { name: "See all decks" })).toBeNull();
  cleanup();

  renderScreen(<Page missing="lead" />);
  screen.getByText("This lead does not exist");
  expect(api.calls().filter((call) => call.includes("lead-nope"))).toHaveLength(
    2,
  );
});

test("a lead with no deck yet, as every real lead is today, says decks generate on their own, and offers no way to generate one", async () => {
  open(NO_DECK);
  await screen.findByText("Stand-in 5 has no deck yet");
  screen.getByText(/Decks generate on their own for valid leads/);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(
    screen.getByRole("link", { name: "Open the lead" }).getAttribute("href"),
  ).toBe(`/leads/${NO_DECK}`);
  cleanup();

  // The same when the server already knows.
  open(NO_DECK, "", "deck");
  await screen.findByText("Stand-in 5 has no deck yet");
});

test("another rep's deck does not exist for a rep", async () => {
  viewAs("rep");
  resetNavigation(deckHref(DANIELS));
  renderScreen(<Page />);
  await screen.findByText("This lead does not exist");
  expect(screen.queryByText(/Stand-in 3/)).toBeNull();
});
