import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { Dashboard } from "@/lib/leads/schemas";
import {
  api,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";

import { DashboardScreen } from "./dashboard-screen";

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

/*
 * The screen against the real Route Handler (guard included). Only
 * getDashboard is replaced: it answers from the six suspect stand-ins the
 * viewer may see (an admin all six, the sample rep their two), as the real one
 * scopes in SQL. Its queries are covered against the database.
 */
const store = vi.hoisted(() => ({
  patch: {} as Partial<Record<keyof Dashboard, unknown>>,
}));
vi.mock("@/lib/data/dashboard", async () => {
  const { leadsModule } = await import("@/test/lead-stand-ins");
  return {
    getDashboard: async (): Promise<Dashboard> => {
      const leads = await leadsModule.listVisibleLeads();
      const ref = (lead: (typeof leads)[number]) => ({
        id: lead.id,
        name: lead.name,
      });
      return {
        newThisWeek: leads.length,
        suspects: leads.length,
        callsNext48h: 0,
        needsYou: leads.map((lead) => ({
          lead: ref(lead),
          reason: "suspect" as const,
          time: lead.createdAt,
        })),
        activity: leads.map((lead) => ({
          id: `event-${lead.id}`,
          actor: { kind: "crm" as const, name: "CRM" },
          type: "Updated from the CRM",
          detail: "created",
          time: lead.createdAt,
          lead: ref(lead),
        })),
        ...(store.patch as Partial<Dashboard>),
      };
    },
  };
});

/** Screens switched on or off for one test, over the real flags. */
const flags = vi.hoisted(() => ({
  on: new Set<string>(),
  off: new Set<string>(),
}));
vi.mock("@/lib/flags", async (original) => {
  const actual = await original<typeof import("@/lib/flags")>();
  return {
    ...actual,
    isLive: (screen: string) =>
      flags.on.has(screen) || (!flags.off.has(screen) && actual.isLive(screen)),
  };
});

beforeEach(() => {
  startDashboard();
  store.patch = {};
  flags.on.clear();
  flags.off.clear();
});
afterEach(() => {
  cleanup();
  stopDashboard();
});

const tile = (label: string) =>
  screen.getByText(label).closest('[data-slot="stat-tile"]') as HTMLElement;
const needsYou = () =>
  screen.getByRole("region", { name: "Needs you now" }) as HTMLElement;
const activity = () =>
  screen.getByRole("region", { name: "Recent activity" }) as HTMLElement;

test("an admin sees every rep's leads: three live tiles, what needs them, the latest activity", async () => {
  renderScreen(<DashboardScreen />);

  expect(await screen.findByText("Every rep's leads", { exact: false }));
  expect(tile("New leads this week").textContent).toContain("6");
  expect(tile("Suspects to review").textContent).toContain("6");
  // Zero calls is a count, shown as 0.
  expect(tile("Calls in the next 48 hours").textContent).toContain("0");
  expect(within(needsYou()).getAllByRole("listitem")).toHaveLength(6);
  expect(within(activity()).getAllByRole("listitem")).toHaveLength(6);
  expect(api.calls()).toContain("GET /api/dashboard?tz=UTC");
});

test("a rep sees only their own leads in the tiles, the list and the activity (check 1)", async () => {
  viewAs("rep");
  renderScreen(<DashboardScreen />);

  expect(await screen.findByText("Your leads", { exact: false }));
  expect(tile("New leads this week").textContent).toContain("2");
  expect(tile("Suspects to review").textContent).toContain("2");
  for (const region of [needsYou(), activity()]) {
    expect(within(region).getByText("Stand-in 1")).toBeDefined();
    expect(within(region).getByText("Stand-in 2")).toBeDefined();
    expect(within(region).queryByText("Stand-in 3")).toBeNull();
  }
});

test("a count that could not be computed reads 'not measured', never 0", async () => {
  store.patch = { callsNext48h: null };
  renderScreen(<DashboardScreen />);

  await screen.findByText("Every rep's leads", { exact: false });
  const shown = tile("Calls in the next 48 hours").textContent;
  expect(shown).toMatch(/not measured/i);
  expect(shown).not.toContain("0");
});

test("the tiles link to their lists while those screens are live, and the decks and proposals tiles wait for theirs", async () => {
  renderScreen(<DashboardScreen />);
  await screen.findByText("Every rep's leads", { exact: false });

  expect(tile("New leads this week").getAttribute("href")).toBe("/leads");
  expect(tile("Suspects to review").getAttribute("href")).toBe("/review-queue");
  // No registry destination: a plain tile.
  expect(tile("Calls in the next 48 hours").tagName).not.toBe("A");
  // Decks and proposals are not live (src/lib/flags.ts): no tiles (check 5).
  expect(screen.queryByText("Decks this week")).toBeNull();
  expect(screen.queryByText("Proposals out")).toBeNull();
});

test("once decks and proposals are live their tiles appear, not measured until something counts them", async () => {
  flags.on.add("deck-library").add("proposal-list");
  flags.off.add("lead-list");
  renderScreen(<DashboardScreen />);
  await screen.findByText("Every rep's leads", { exact: false });

  expect(tile("Decks this week").getAttribute("href")).toBe("/decks");
  expect(tile("Decks this week").textContent).toMatch(/not measured/i);
  expect(tile("Proposals out").getAttribute("href")).toBe("/proposals");
  // The lead list is off, so its tile is no longer a link.
  expect(tile("New leads this week").tagName).not.toBe("A");
});

test("each lead links to its detail page while lead detail is live", async () => {
  renderScreen(<DashboardScreen />);
  await screen.findByText("Every rep's leads", { exact: false });

  const [first] = within(needsYou()).getAllByRole("link");
  expect(first.getAttribute("href")).toBe("/leads/stand-in-1");
  expect(first.textContent).toContain("Suspect");
  expect(within(activity()).getAllByRole("link")[0].getAttribute("href")).toBe(
    "/leads/stand-in-1",
  );
});

test("while lead detail is not live, nothing links to it (check 5)", async () => {
  flags.off.add("lead-detail");
  renderScreen(<DashboardScreen />);
  await screen.findByText("Every rep's leads", { exact: false });

  expect(within(needsYou()).getByText("Stand-in 1")).toBeDefined();
  expect(within(needsYou()).queryAllByRole("link")).toHaveLength(0);
  expect(within(activity()).queryAllByRole("link")).toHaveLength(0);
});

test("with no leads at all, the registry's empty state, as an explicit empty variant", async () => {
  store.patch = { newThisWeek: 0, suspects: 0, needsYou: [], activity: [] };
  renderScreen(<DashboardScreen />);

  expect(await screen.findByText("No leads yet")).toBeDefined();
  expect(
    screen.getByText("New form fills land here automatically."),
  ).toBeDefined();
  const state = document.querySelector('[data-slot="empty-state"]');
  expect(state?.textContent).not.toMatch(/filtered|not connected/i);
  // The tiles still say the true count.
  expect(tile("New leads this week").textContent).toContain("0");
});

test("nothing waiting is said in words, beside the activity", async () => {
  store.patch = { needsYou: [] };
  renderScreen(<DashboardScreen />);

  expect(
    await within(
      await screen.findByRole("region", { name: "Needs you now" }),
    ).findByText("Nothing needs you right now."),
  ).toBeDefined();
  expect(within(activity()).getAllByRole("listitem")).toHaveLength(6);
});

test("a failed read shows the error state, and Try again reads it again", async () => {
  api.fail("GET", /^\/api\/dashboard$/, 500, { once: true });
  renderScreen(<DashboardScreen />);

  expect((await screen.findByRole("alert")).textContent).toContain(
    "The dashboard did not load",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Suspects to review")).toBeDefined();
  expect(tile("Suspects to review").textContent).toContain("6");
});
