import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getLead, getPipelineSummary } from "@/lib/data/leads";
import {
  api,
  FORBIDDEN,
  leadIdOf,
  renderScreen,
  startDashboard,
  stopDashboard,
} from "@/test/dashboard";

import { LeadScreen } from "./lead-screen";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);
vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationModule,
);
vi.mock(
  "@/lib/navigate",
  async () => (await import("@/test/render")).navigateModule,
);

beforeEach(() => startDashboard("/dashboard/leads/x"));
afterEach(() => {
  cleanup();
  stopDashboard();
});

/** Opens the detail page of the sample lead with this name. */
async function open(name: string) {
  const leadId = await leadIdOf(name);
  renderScreen(<LeadScreen leadId={leadId} />);
  await screen.findByRole("heading", { level: 1, name: new RegExp(name) });
  return leadId;
}
const button = (name: string | RegExp) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const noButton = (name: string | RegExp) =>
  expect(screen.queryByRole("button", { name })).toBeNull();
const chips = () =>
  within(screen.getByRole("list", { name: "Where this lead stands" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
const hint = () =>
  document.querySelector('[data-slot="hint-line"]')?.textContent ?? "";
const timeline = () =>
  within(
    screen.getByRole("heading", { name: "Activity" })
      .parentElement as HTMLElement,
  ).getAllByRole("listitem");
const confirmIn = (name: RegExp) =>
  within(screen.getByRole("alertdialog", { name }));

test("shows the header chips, details, form answers, verdict box, the three status panels and the timeline", async () => {
  await open("Kwame Asante");

  expect(chips()).toEqual([
    "Stage: Qualified",
    "Qualified",
    "Verdict: Valid",
    "Owner: Tom Lindqvist",
    "Proposal: Draft",
  ]);
  expect(screen.getByText("Asante Solar")).toBeDefined();

  // Email, phone and website are links.
  expect(
    screen
      .getByRole("link", { name: "kwame@asantesolar.example" })
      .getAttribute("href"),
  ).toBe("mailto:kwame@asantesolar.example");
  expect(
    screen.getByRole("link", { name: /^\(555\) 555-01/ }).getAttribute("href"),
  ).toMatch(/^tel:/);
  const site = screen.getByRole("link", { name: /^asantesolar\.example/ });
  expect(site.getAttribute("href")).toBe("https://asantesolar.example");
  expect(site.getAttribute("target")).toBe("_blank");
  expect(screen.getByText("No call booked")).toBeDefined();

  expect(screen.getByText("What service are you interested in?")).toBeDefined();
  expect(screen.getByText("Paid search")).toBeDefined();

  const verdict = document.querySelector('[data-slot="verdict-box"]');
  expect(verdict?.getAttribute("data-tone")).toBe("ok");
  expect(verdict?.textContent).toContain("Valid");
  expect(verdict?.textContent).toContain("Installer registration matches.");

  for (const panel of ["Deck", "Proposal", "Invoice"]) {
    expect(screen.getByRole("heading", { name: panel })).toBeDefined();
  }
  expect(screen.getAllByText(/^Not available yet/)).toHaveLength(3);
  expect(screen.getAllByText("No invoice yet")).toHaveLength(2);

  // Newest first, each saying who or what acted.
  const entries = timeline().map((item) => item.textContent);
  expect(entries[0]).toContain("Tom Lindqvist");
  expect(entries.at(-1)).toContain("Form submitted");
  expect(entries.at(-1)).toContain("CRM");
  expect(entries.some((entry) => entry?.includes("System"))).toBe(true);

  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("a lead with little shows a dash for each missing value and says there are no answers", async () => {
  await open("Callum Adeyemi");
  expect(screen.getAllByText("Not given").length).toBeGreaterThanOrEqual(3);
  expect(screen.getByText("No form answers on this lead.")).toBeDefined();
  // Awaiting a verdict: the box says so and gives no reasons.
  const verdict = document.querySelector('[data-slot="verdict-box"]');
  expect(verdict?.getAttribute("data-tone")).toBe("warn");
  expect(verdict?.textContent).toContain("The AI is still checking this lead.");
  expect(verdict?.querySelector("li")).toBeNull();
});

// One sample lead per row of the action table in spec 06.
test.each([
  [
    "Imogen Vasquez",
    null,
    "The AI is still checking this lead. Nothing to do yet.",
  ],
  [
    "Lena Marchetti",
    "Review suspect",
    "The AI is unsure about this lead. Decide whether it is genuine.",
  ],
  [
    "Sofia Lindgren",
    null,
    "Waiting for the lead to book a call. Your CRM is following up.",
  ],
  [
    "Odette Blackwood",
    null,
    "Waiting for the lead to book a call. Your CRM is following up.",
  ],
  [
    "Priscilla Nwosu",
    "Open deck",
    "Present the deck on the call. Come back here afterwards to record the outcome.",
  ],
  [
    "Desmond Achterberg",
    "Qualified",
    "The call is done. Record whether this lead is a fit.",
  ],
  ["Beatrix Olander", "Start proposal", "Qualified. Build the proposal next."],
  [
    "Emeka Obi",
    "Finish proposal",
    "A review call is booked. Have the proposal ready to send.",
  ],
  [
    "Anneliese Brandt",
    null,
    "Proposal sent. Waiting for the lead to view and sign it.",
  ],
  [
    "Jonas Whitlock",
    "Check invoice draft",
    "Signed. Check the invoice draft. Invoice drafts are not available yet.",
  ],
])(
  "%s: the main action and the hint line follow the action table",
  async (name, main, text) => {
    const leadId = await open(name);
    expect(hint()).toBe(text);

    const actions = within(screen.getByRole("region", { name: "Actions" }));
    const primary = [
      ...actions.queryAllByRole("button"),
      ...actions.queryAllByRole("link"),
    ].filter((control) => control.className.includes("bg-primary"));
    expect(primary.map((control) => control.textContent)).toEqual(
      main ? [main] : [],
    );

    // Where the actions that are not built yet lead.
    const destination: Record<string, string> = {
      "Review suspect": `/dashboard/suspects/${leadId}`,
      "Open deck": "/dashboard/deck-presenter",
      "Start proposal": "/dashboard/proposal-builder",
      "Finish proposal": "/dashboard/proposal-builder",
    };
    if (main && destination[main]) {
      expect(primary[0].getAttribute("href")).toBe(destination[main]);
    }
    if (main === "Check invoice draft") {
      expect((primary[0] as HTMLButtonElement).disabled).toBe(true);
    }
    // Not qualified sits beside Qualified, and nowhere else.
    expect(
      actions.queryAllByRole("button", { name: "Not qualified" }),
    ).toHaveLength(main === "Qualified" ? 1 : 0);
    // The standing actions: lost while in the pipeline, spam until the lead has won.
    expect(actions.getByRole("button", { name: "Mark lost" })).toBeDefined();
    expect(
      actions.queryAllByRole("button", { name: "Mark spam" }),
    ).toHaveLength(name === "Jonas Whitlock" ? 0 : 1);
  },
);

test("an exited lead is struck through, names its exit, explains itself and offers no action", async () => {
  await open("Cordelia Vance");
  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.querySelector("s")?.textContent).toBe("Cordelia Vance");
  expect(chips().slice(0, 2)).toEqual(["Exit: Lead Lost", "Not a fit"]);
  expect(hint()).toContain("This lead left the pipeline: Lead Lost.");
  expect(hint()).toContain("Not qualified after the discovery call.");
  expect(
    within(screen.getByRole("region", { name: "Actions" })).queryAllByRole(
      "button",
    ),
  ).toEqual([]);
  expect(screen.queryByRole("link", { name: /deck|proposal/i })).toBeNull();
});

test("a reviewed suspect shows the outcome, who decided and when", async () => {
  await open("Odette Blackwood");
  const verdict = document.querySelector('[data-slot="verdict-box"]');
  expect(verdict?.getAttribute("data-tone")).toBe("ok");
  expect(verdict?.textContent).toContain("Valid");
  expect(verdict?.textContent).toMatch(
    /The AI was unsure about this lead\. Priya Nair cleared it as valid on \w{3}, Oct \d+, \d+:\d\d [AP]M\./,
  );

  cleanup();
  await open("Wendell Krause");
  expect(
    document.querySelector('[data-slot="verdict-box"]')?.textContent,
  ).toContain("Tom Lindqvist marked it as spam on");
  expect(screen.getByText("(Cancelled)")).toBeDefined();
});

test("Qualified moves the lead on: stage, status, main action and a timeline entry naming the signed-in user", async () => {
  const leadId = await open("Desmond Achterberg");
  const entries = timeline().length;
  const before = await getPipelineSummary({ tz: "UTC" });

  fireEvent.click(button("Qualified"));

  await screen.findByRole("link", { name: "Start proposal" });
  expect(chips().slice(0, 2)).toEqual(["Stage: Qualified", "Qualified"]);
  expect(hint()).toBe("Qualified. Build the proposal next.");
  noButton("Not qualified");
  expect(timeline()).toHaveLength(entries + 1);
  expect(timeline()[0].textContent).toContain("Ada Lovelace");
  expect(timeline()[0].textContent).toContain(
    "Marked qualified after the discovery call.",
  );
  await screen.findByText("Marked qualified: Desmond Achterberg");

  // The Pipeline's counts moved with it.
  expect((await getLead(leadId)).stage).toBe("qualified");
  const after = await getPipelineSummary({ tz: "UTC" });
  expect(after.stages.qualified).toBe(before.stages.qualified + 1);
  expect(after.stages.discovery_booked).toBe(
    before.stages.discovery_booked - 1,
  );
});

test("Not qualified asks first: Cancel changes nothing, confirming moves the lead to Lead Lost as Not a fit", async () => {
  const leadId = await open("Rosalind Mbeki");

  fireEvent.click(button("Not qualified"));
  const dialog = confirmIn(/Mark Rosalind Mbeki not qualified\?/);
  expect(dialog.getByText(/leaves the pipeline as Lead Lost/)).toBeDefined();
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect((await getLead(leadId)).exit).toBeNull();
  expect(chips()[0]).toBe("Stage: Discovery Call Booked");

  fireEvent.click(button("Not qualified"));
  fireEvent.click(
    confirmIn(/Mark Rosalind Mbeki not qualified\?/).getByRole("button", {
      name: "Mark not qualified",
    }),
  );
  await waitFor(() =>
    expect(chips().slice(0, 2)).toEqual(["Exit: Lead Lost", "Not a fit"]),
  );
  noButton("Qualified");
  noButton("Mark lost");
  noButton("Mark spam");
});

test("Mark lost takes an optional reason, and the timeline entry shows it", async () => {
  await open("Anneliese Brandt");

  fireEvent.click(button("Mark lost"));
  const dialog = confirmIn(/Mark Anneliese Brandt lost\?/);
  fireEvent.change(dialog.getByLabelText("Reason (optional)"), {
    target: { value: "  Chose another agency " },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Mark lost" }));

  await waitFor(() => expect(chips()[0]).toBe("Exit: Lead Lost"));
  expect(chips()[1]).toBe("Removed from pipeline");
  expect(timeline()[0].textContent).toContain("Reason: Chose another agency");
  expect(timeline()[0].textContent).toContain("Ada Lovelace");
  expect(hint()).toContain("This lead left the pipeline: Lead Lost.");
});

test("Mark spam moves the lead to Spam, shows its call as cancelled and removes every action", async () => {
  await open("Henrik Solberg");
  expect(screen.getByText("(Confirmed)")).toBeDefined();

  fireEvent.click(button("Mark spam"));
  const dialog = confirmIn(/Mark Henrik Solberg as spam\?/);
  expect(dialog.getByText(/any upcoming call is cancelled/)).toBeDefined();
  fireEvent.click(dialog.getByRole("button", { name: "Mark as spam" }));

  await waitFor(() => expect(chips()[0]).toBe("Exit: Spam"));
  expect(screen.getByText("(Cancelled)")).toBeDefined();
  expect(screen.queryByText("(Confirmed)")).toBeNull();
  expect(screen.getAllByText("No call booked").length).toBeGreaterThan(0);
  expect(
    within(screen.getByRole("region", { name: "Actions" })).queryAllByRole(
      "button",
    ),
  ).toEqual([]);
  expect(screen.queryByRole("link", { name: "Open deck" })).toBeNull();
});

test("while an action is in progress the pressed button shows it and no other action can be pressed", async () => {
  await open("Ignatius Petrov");
  const release = api.hold("POST", /\/qualification$/);

  fireEvent.click(button("Qualified"));
  await waitFor(() =>
    expect(button(/^(Loading\s*)?Qualified$/).getAttribute("aria-busy")).toBe(
      "true",
    ),
  );
  for (const name of ["Not qualified", "Mark lost", "Mark spam"]) {
    expect(button(name).disabled).toBe(true);
  }
  // A second press records nothing more.
  fireEvent.click(button(/^(Loading\s*)?Qualified$/));

  release();
  await screen.findByRole("link", { name: "Start proposal" });
  expect(api.calls().filter((call) => call.startsWith("POST "))).toHaveLength(
    1,
  );
});

test("when an action fails the lead is unchanged, a message says so and Try again repeats it", async () => {
  const leadId = await open("Desmond Achterberg");
  const before = await getLead(leadId);
  api.fail("POST", /\/qualification$/);

  fireEvent.click(button("Qualified"));
  await screen.findByText("That did not go through. The lead is unchanged.");
  expect(chips()[0]).toBe("Stage: Discovery Call Booked");
  expect(button("Qualified").disabled).toBe(false);
  expect(await getLead(leadId)).toEqual(before);

  api.restore();
  fireEvent.click(button("Try again"));
  await screen.findByRole("link", { name: "Start proposal" });
  expect(screen.queryByText(/did not go through/)).toBeNull();
});

test("an action the lead no longer allows is refused, and the page shows the lead as it now is", async () => {
  const leadId = await open("Desmond Achterberg");
  // Someone else marks the lead lost while this page is open.
  const { markLost } = await import("@/lib/data/leads");
  await markLost(leadId, { reason: "Duplicate" });

  fireEvent.click(button("Qualified"));
  await screen.findByText(
    /This lead had changed, so that action no longer applies/,
  );
  await waitFor(() => expect(chips()[0]).toBe("Exit: Lead Lost"));
  noButton("Qualified");
});

test("an unknown lead id shows the not-found panel with a way back, not the error state", async () => {
  renderScreen(<LeadScreen leadId="lead-999" />);
  await screen.findByText("This lead does not exist");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Back to the Pipeline" })
      .getAttribute("href"),
  ).toBe("/dashboard");

  // When the server already knows, nothing is requested at all.
  cleanup();
  vi.mocked(fetch).mockClear();
  renderScreen(<LeadScreen leadId="lead-999" missing />);
  expect(screen.getByText("This lead does not exist")).toBeDefined();
  expect(fetch).not.toHaveBeenCalled();
});

test("loading shows a skeleton; a failed load shows the error state with Try again and a way back", async () => {
  const leadId = await leadIdOf("Sofia Lindgren");
  api.fail("GET", /^\/api\/leads\/lead-/);
  renderScreen(<LeadScreen leadId={leadId} />);

  expect(screen.getByRole("status", { name: "Loading lead" })).toBeDefined();
  await screen.findByText("This lead could not be loaded");
  expect(screen.getByRole("alert")).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Back to the Pipeline" }),
  ).toBeDefined();

  api.restore();
  fireEvent.click(button("Try again"));
  await screen.findByRole("heading", { level: 1, name: "Sofia Lindgren" });
});

test("a long timeline shows the newest 20 until Show earlier is pressed", async () => {
  await open("Philippa Ashdown");
  expect(timeline()).toHaveLength(20);
  fireEvent.click(button(/^Show earlier \(\d+\)$/));
  expect(timeline().length).toBeGreaterThan(20);
  expect(timeline().at(-1)?.textContent).toContain("Form submitted");
  noButton(/^Show earlier/);
});

test("the way back to the Pipeline carries the filters the rep last had there", async () => {
  sessionStorage.setItem(
    "dealwright:pipeline-search",
    "tab=qualified&q=asante",
  );
  await open("Kwame Asante");
  expect(
    screen.getByRole("link", { name: "Pipeline" }).getAttribute("href"),
  ).toBe("/dashboard?tab=qualified&q=asante");
});
