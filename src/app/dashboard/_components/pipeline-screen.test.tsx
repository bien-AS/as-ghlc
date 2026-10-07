import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getPipelineSummary } from "@/lib/data/leads";
import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
} from "@/test/dashboard";
import { address, router } from "@/test/navigation";

import { PipelineScreen } from "./pipeline-screen";

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

beforeEach(() => startDashboard("/dashboard"));
afterEach(() => {
  cleanup();
  stopDashboard();
});

const rows = () =>
  within(screen.getByRole("list")).getAllByRole<HTMLAnchorElement>("link");
const row = (name: string) => {
  const found = rows().find((link) => link.textContent?.includes(name));
  if (!found) throw new Error(`no row for ${name}`);
  return found;
};
const tab = (name: RegExp) => screen.getByRole("tab", { name });
const loaded = () =>
  screen.findByText(/^All \d+ leads? shown$|Show more leads/);

test("shows the strip, the tabs with counts and the list; each row carries the six fields and opens its lead", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();
  const counts = await getPipelineSummary({ tz: "UTC" });

  expect(screen.getByRole("heading", { name: "Pipeline" })).toBeDefined();
  expect(tab(/^All open/).getAttribute("aria-selected")).toBe("true");
  expect(tab(/^All open/).textContent).toContain(String(counts.open));
  expect(tab(/^Qualified/).textContent).toContain(
    String(counts.stages.qualified),
  );
  expect(tab(/^Lead Lost/).textContent).toContain(String(counts.exits.lost));
  expect(screen.getByText(`${counts.open} leads`)).toBeDefined();

  // Name, company, status line, stage (under All open), verdict, next call, owner.
  const lead = row("Priscilla Nwosu");
  expect(lead.getAttribute("href")).toMatch(/^\/dashboard\/leads\/lead-\d+$/);
  const cells = within(lead);
  expect(cells.getByText("Nwosu Paediatrics")).toBeDefined();
  expect(cells.getByText("Deck ready")).toBeDefined();
  expect(cells.getByText("Discovery Call Booked")).toBeDefined();
  expect(cells.getByText("Valid")).toBeDefined();
  expect(cells.getByText("Wed, Oct 7, 12:30 PM")).toBeDefined();
  expect(cells.getByText("Maya Okafor")).toBeDefined();

  // A lead with no call says so; one with little still has a full row.
  expect(
    within(row("Sofia Lindgren")).getByText("No call booked"),
  ).toBeDefined();
  expect(
    within(row("Callum Adeyemi")).getByText("No company given"),
  ).toBeDefined();
  expect(
    within(row("Callum Adeyemi")).getByText("Awaiting verdict"),
  ).toBeTruthy();

  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("the first page is 25 leads; asking for more loads the rest once, then says all are shown", async () => {
  renderScreen(<PipelineScreen />);
  await screen.findByRole("button", { name: "Show more leads" });
  expect(rows()).toHaveLength(25);
  const { open } = await getPipelineSummary({ tz: "UTC" });

  fireEvent.click(screen.getByRole("button", { name: "Show more leads" }));
  await screen.findByText(`All ${open} leads shown`);
  expect(rows()).toHaveLength(open);
  const hrefs = rows().map((link) => link.getAttribute("href"));
  expect(new Set(hrefs).size).toBe(open);
});

test("choosing a tab puts it in the address and shows only that stage; each count equals its rows", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();
  const counts = await getPipelineSummary({ tz: "UTC" });

  fireEvent.click(tab(/^Qualified/));
  expect(address()).toBe("/dashboard?tab=qualified");
  await screen.findByText(`All ${counts.stages.qualified} leads shown`);
  expect(rows()).toHaveLength(counts.stages.qualified);
  expect(rows().map((link) => link.textContent)).toEqual(
    expect.arrayContaining([expect.stringContaining("Beatrix Olander")]),
  );
  expect(screen.queryByText("Sofia Lindgren")).toBeNull();

  // All open is the default, so it leaves no trace in the address.
  fireEvent.click(tab(/^All open/));
  expect(address()).toBe("/dashboard");
});

test("a lead that has left the pipeline is struck through and names its exit", async () => {
  startDashboard("/dashboard?tab=spam");
  renderScreen(<PipelineScreen />);
  await loaded();

  expect(tab(/^Spam/).getAttribute("aria-selected")).toBe("true");
  const lead = row("Wendell Krause");
  expect(lead.querySelector("s")?.textContent).toBe("Wendell Krause");
  expect(within(lead).getByText(/left the pipeline\)/)).toBeDefined();
  expect(within(lead).getByText("Left the pipeline: Spam")).toBeDefined();
  expect(within(lead).getByText("Removed from pipeline")).toBeDefined();
});

test("typing in the search narrows the list by name, company or email and is kept in the address", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();

  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search by name, company or email" }),
    { target: { value: "  BELLWEATHER " } },
  );
  await waitFor(() => expect(address()).toBe("/dashboard?q=BELLWEATHER"));
  // Typing replaces the entry, so Back does not step through every keystroke.
  expect(router.replace).toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
  await screen.findByText("1 lead match");
  expect(rows()).toHaveLength(1);
  expect(rows()[0].textContent).toContain("Marcus Bellweather");

  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(address()).toBe("/dashboard");
  await screen.findByRole("button", { name: "Show more leads" });
  expect(
    screen.getByRole<HTMLInputElement>("searchbox", {
      name: "Search by name, company or email",
    }).value,
  ).toBe("");
});

test("the verdict and rep filters narrow the list, combine, and survive a reload of the address", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();

  fireEvent.change(screen.getByRole("combobox", { name: "Verdict" }), {
    target: { value: "suspect" },
  });
  expect(address()).toBe("/dashboard?verdict=suspect");
  await screen.findByText("6 leads match");
  expect(rows().every((link) => link.textContent?.includes("Suspect"))).toBe(
    true,
  );

  fireEvent.change(screen.getByRole("combobox", { name: "Rep" }), {
    target: { value: "rep-maya" },
  });
  expect(address()).toBe("/dashboard?verdict=suspect&owner=rep-maya");
  await screen.findByText("2 leads match");
  expect(
    rows().every((link) => link.textContent?.includes("Maya Okafor")),
  ).toBe(true);

  // The same address, opened fresh, is the same view.
  cleanup();
  startDashboard("/dashboard?verdict=suspect&owner=rep-maya");
  renderScreen(<PipelineScreen />);
  await screen.findByText("2 leads match");
  expect(
    screen.getByRole<HTMLSelectElement>("combobox", { name: "Verdict" }).value,
  ).toBe("suspect");
  expect(
    screen.getByRole<HTMLSelectElement>("combobox", { name: "Rep" }).value,
  ).toBe("rep-maya");
});

test("each needs-you count is a button that filters to those leads; suspects opens Suspect review; zero is inactive", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();
  const { needs } = await getPipelineSummary({ tz: "UTC" });

  const suspects = screen.getByRole("link", { name: /Suspects to review/ });
  expect(suspects.getAttribute("href")).toBe("/dashboard/suspects");
  expect(suspects.textContent).toContain(String(needs.suspects));

  const calls = screen.getByRole("button", { name: /Calls today/ });
  expect(calls.textContent).toContain(String(needs.calls_today));
  fireEvent.click(calls);
  expect(address()).toBe("/dashboard?needs=calls_today");
  await screen.findByText(`${needs.calls_today} leads match`);
  expect(rows()).toHaveLength(needs.calls_today);
  expect(calls.getAttribute("aria-pressed")).toBe("true");

  // Pressing it again takes the filter off.
  fireEvent.click(calls);
  expect(address()).toBe("/dashboard");

  for (const [name, count] of [
    [/Proposals to send/, needs.proposals],
    [/Invoice drafts/, needs.invoices],
  ] as const) {
    expect(screen.getByRole("button", { name }).textContent).toContain(
      String(count),
    );
  }

  // Tomorrow nothing is booked today: the count is a zero and cannot be pressed.
  cleanup();
  startDashboard("/dashboard");
  await getPipelineSummary({ tz: "UTC" }); // the sample is placed around "now"
  vi.setSystemTime(new Date("2026-10-20T12:00:00.000Z"));
  renderScreen(<PipelineScreen />);
  await loaded();
  const none = screen.getByRole<HTMLButtonElement>("button", {
    name: /Calls today/,
  });
  expect(none.textContent).toContain("0");
  expect(none.disabled).toBe(true);
});

test("a search that matches nothing says so, restates the search and offers Clear filters", async () => {
  startDashboard("/dashboard?q=zzzz&verdict=valid");
  renderScreen(<PipelineScreen />);

  await screen.findByText("No leads match");
  expect(
    screen.getByText("Nothing in All open matches “zzzz”, verdict Valid."),
  ).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(address()).toBe("/dashboard");
  await screen.findByRole("button", { name: "Show more leads" });
});

test("a tab with no leads says so, without blaming a filter", async () => {
  startDashboard("/dashboard?tab=nurture");
  const empty = { items: [], nextCursor: null, total: 0 };
  vi.mocked(fetch).mockImplementation(async (input) =>
    String(input).startsWith("/api/leads?")
      ? Response.json(empty)
      : Response.json({
          open: 3,
          stages: {
            new: 3,
            discovery_booked: 0,
            qualified: 0,
            review_booked: 0,
            proposal_sent: 0,
            won: 0,
          },
          exits: { spam: 0, nurture: 0, lost: 0 },
          needs: { suspects: 0, calls_today: 0, proposals: 0, invoices: 0 },
          owners: [],
        }),
  );
  renderScreen(<PipelineScreen />);
  await screen.findByText("No leads in Nurture.");
  expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
});

test("with no leads at all, the empty state says where leads come from", async () => {
  vi.mocked(fetch).mockImplementation(async (input) =>
    String(input).startsWith("/api/leads?")
      ? Response.json({ items: [], nextCursor: null, total: 0 })
      : Response.json({
          open: 0,
          stages: {
            new: 0,
            discovery_booked: 0,
            qualified: 0,
            review_booked: 0,
            proposal_sent: 0,
            won: 0,
          },
          exits: { spam: 0, nurture: 0, lost: 0 },
          needs: { suspects: 0, calls_today: 0, proposals: 0, invoices: 0 },
          owners: [],
        }),
  );
  renderScreen(<PipelineScreen />);
  await screen.findByText("No leads yet");
  expect(
    screen.getByText("Leads appear here when they come in from your CRM."),
  ).toBeDefined();
});

test("while the list is loading, skeleton rows stand in for it", async () => {
  const release = api.hold("GET", /^\/api\/leads$/);
  renderScreen(<PipelineScreen />);

  expect(
    await screen.findByRole("status", { name: "Loading leads" }),
  ).toBeDefined();
  expect(screen.queryByRole("list")).toBeNull();

  release();
  await loaded();
  expect(screen.queryByRole("status", { name: "Loading leads" })).toBeNull();
});

test("when the list fails, the error state offers Try again and the tabs and strip stay", async () => {
  api.fail("GET", /^\/api\/leads$/);
  renderScreen(<PipelineScreen />);

  await screen.findByText("The leads could not be loaded");
  expect(screen.getByRole("alert")).toBeDefined();
  expect(tab(/^All open/).textContent).toMatch(/\d/);
  expect(
    screen.getByRole("link", { name: /Suspects to review/ }),
  ).toBeDefined();

  api.restore();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await loaded();
  expect(rows().length).toBeGreaterThan(0);
});

test("when the counts fail, they show no numbers rather than zeros, and the list still works", async () => {
  api.fail("GET", /^\/api\/pipeline\/summary$/);
  renderScreen(<PipelineScreen />);
  await loaded();

  expect(screen.getByText("The counts could not be loaded.")).toBeDefined();
  expect(tab(/^All open/).textContent).toBe("All open");
  expect(screen.getAllByText("unavailable")).toHaveLength(4);
  expect(rows()).toHaveLength(25);

  api.restore();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(tab(/^All open/).textContent).toMatch(/\d/));
});

test("when loading more fails, the rows already loaded stay and an inline retry takes over", async () => {
  renderScreen(<PipelineScreen />);
  await screen.findByRole("button", { name: "Show more leads" });

  api.fail("GET", /^\/api\/leads$/);
  fireEvent.click(screen.getByRole("button", { name: "Show more leads" }));
  await screen.findByText("More leads could not be loaded.");
  expect(rows()).toHaveLength(25);

  api.restore();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText(/^All \d+ leads shown$/);
  expect(rows().length).toBeGreaterThan(25);
});
