import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";
import { resetLeadStore } from "@/test/lead-store";
import { address, router } from "@/test/navigation";

import { PipelineScreen } from "./pipeline-screen";

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
vi.mock("@/lib/data/leads", async (original) => ({
  ...(await original<typeof import("@/lib/data/leads")>()),
  ...(await import("@/test/lead-store")).leadsModule,
}));
vi.mock(
  "@/lib/data/research",
  async () => (await import("@/test/lead-store")).researchModule,
);

beforeEach(() => {
  startDashboard("/leads");
  resetLeadStore();
});
afterEach(() => {
  cleanup();
  stopDashboard();
});

/** The desktop table (the card list below md renders the same rows). */
const table = () => screen.getByRole("table");
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
/** The lead names, in the order the table shows them. */
const names = () =>
  bodyRows().map((row) => row.querySelector("a")?.textContent ?? "");
const row = (name: string) => {
  const found = bodyRows().find((r) => r.textContent?.includes(name));
  if (!found) throw new Error(`no row for ${name}`);
  return found;
};
const loaded = () => screen.findByRole("table");
const header = (name: string) => within(table()).getByRole("button", { name });

test("an admin sees every active lead, the rep column and the rep filter (check 1)", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();

  expect(screen.getByRole("heading", { name: "Leads" })).toBeDefined();
  expect(names().sort()).toEqual(
    [
      "Beatrix Olander",
      "Desmond Achterberg",
      "Emeka Obi",
      "Imogen Vasquez",
      "Sofia Lindgren",
    ].sort(),
  );
  expect(
    within(table()).getByRole("columnheader", { name: /^Rep/ }),
  ).toBeDefined();
  await screen.findByRole("option", { name: "Jonah Pike" });
  expect(screen.getByLabelText("Rep")).toBeDefined();

  // Each row carries its verdict, stage, Lead Status, rep, age and next step.
  const imogen = within(row("Imogen Vasquez"));
  expect(imogen.getByText("Vasquez Co")).toBeDefined();
  expect(imogen.getByText("Valid")).toBeDefined();
  expect(imogen.getByText("Discovery Call Booked")).toBeDefined();
  expect(imogen.getByText("Appointment - Completed")).toBeDefined();
  expect(imogen.getByText("Maya Okafor")).toBeDefined();
  expect(imogen.getByText("3 days")).toBeDefined();
  expect(within(row("Beatrix Olander")).getByText("Unassigned")).toBeDefined();
  expect(
    within(row("Beatrix Olander")).getByText("No status yet"),
  ).toBeDefined();

  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("a rep sees only their own leads, with no rep column and no rep filter (check 1)", async () => {
  viewAs("rep");
  renderScreen(<PipelineScreen />);
  await loaded();
  // The role arrives with the viewer; wait until the screen has drawn for it.
  await waitFor(() => expect(screen.getByText(/^Your leads/)).toBeDefined());

  expect(names().sort()).toEqual(["Desmond Achterberg", "Imogen Vasquez"]);
  expect(
    within(table()).queryByRole("columnheader", { name: /^Rep/ }),
  ).toBeNull();
  expect(screen.queryByLabelText("Rep")).toBeNull();
  expect(document.body.textContent).not.toContain("Jonah Pike");
});

test("age shows Not measured for a never-synced lead, never 0, and sorts it last in both directions (check 2)", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();
  expect(within(row("Sofia Lindgren")).getByText("Not measured")).toBeDefined();
  expect(
    within(row("Beatrix Olander")).getByText("Not measured"),
  ).toBeDefined();

  fireEvent.click(header("Age"));
  expect(names().slice(0, 3)).toEqual([
    "Emeka Obi",
    "Imogen Vasquez",
    "Desmond Achterberg",
  ]);
  expect(names().slice(3).sort()).toEqual([
    "Beatrix Olander",
    "Sofia Lindgren",
  ]);

  fireEvent.click(header("Age"));
  expect(names().slice(0, 3)).toEqual([
    "Desmond Achterberg",
    "Imogen Vasquez",
    "Emeka Obi",
  ]);
  expect(names().slice(3).sort()).toEqual([
    "Beatrix Olander",
    "Sofia Lindgren",
  ]);
});

test("each filter goes in the address and narrows the list; Clear filters takes them all out", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();

  fireEvent.change(screen.getByLabelText("Verdict"), {
    target: { value: "suspect" },
  });
  expect(address()).toBe("/leads?verdict=suspect");
  await waitFor(() => expect(names()).toEqual(["Emeka Obi"]));

  fireEvent.change(screen.getByLabelText("Verdict"), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("Lead Status"), {
    target: { value: "Qualified" },
  });
  expect(address()).toBe("/leads?group=Qualified");
  await waitFor(() => expect(names()).toEqual(["Desmond Achterberg"]));

  fireEvent.change(screen.getByLabelText("Lead Status"), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("Rep"), {
    target: { value: "unassigned" },
  });
  expect(address()).toBe("/leads?owner=unassigned");
  await waitFor(() => expect(names()).toEqual(["Beatrix Olander"]));

  fireEvent.change(screen.getByLabelText("Stage"), {
    target: { value: "qualified" },
  });
  expect(address()).toBe("/leads?owner=unassigned&tab=qualified");
  const none = await screen.findByText("No leads match these filters");
  expect(none).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(address()).toBe("/leads");
  await waitFor(() => expect(names()).toHaveLength(5));

  fireEvent.change(screen.getByLabelText("Showing"), {
    target: { value: "true" },
  });
  expect(address()).toBe("/leads?archived=true");
  await waitFor(() => expect(names()).toEqual(["Jonas Whitlock"]));
});

test("a row opens its lead; the name is a link to it too", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();
  const imogen = row("Imogen Vasquez");
  expect(imogen.querySelector("a")?.getAttribute("href")).toBe(
    "/leads/lead-imogen",
  );
  fireEvent.click(within(imogen).getByText("Discovery Call Booked"));
  expect(router.push).toHaveBeenCalledWith("/leads/lead-imogen");
});

test("the sync indicator says the last write and its result; an admin's opens the sync log", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();
  const written = within(row("Imogen Vasquez")).getByRole("link", {
    name: "Validation verdict: written. Open the sync log",
  });
  expect(written.getAttribute("href")).toBe("/admin/sync-log");
  expect(
    within(row("Sofia Lindgren")).getByRole("link", {
      name: "Nothing written to the CRM yet. Open the sync log",
    }),
  ).toBeDefined();

  cleanup();
  viewAs("rep");
  renderScreen(<PipelineScreen />);
  await loaded();
  await waitFor(() => expect(screen.getByText(/^Your leads/)).toBeDefined());
  // A rep reads it on hover or focus; the sync log is not theirs to open.
  expect(
    within(row("Imogen Vasquez")).getByLabelText("Validation verdict: written")
      .tagName,
  ).toBe("SPAN");
  expect(document.querySelector('a[href="/admin/sync-log"]')).toBeNull();
});

test("Archive says it writes nothing to the CRM; confirming archives once and the row leaves the list", async () => {
  renderScreen(<PipelineScreen />);
  await loaded();

  fireEvent.click(
    within(row("Imogen Vasquez")).getByRole("button", {
      name: "Archive Imogen Vasquez",
    }),
  );
  const dialog = await screen.findByRole("alertdialog");
  expect(within(dialog).getByText(/^Nothing in the CRM/)).toBeDefined();
  fireEvent.change(within(dialog).getByLabelText("Reason (optional)"), {
    target: { value: "Duplicate of Desmond" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Archive lead" }));

  await screen.findByText("Archived Imogen Vasquez");
  expect(api.calls().filter((call) => call.startsWith("POST"))).toEqual([
    "POST /api/leads/lead-imogen/archive",
  ]);
  await waitFor(() => expect(names()).not.toContain("Imogen Vasquez"));
  // Opening the dialog or confirming never opened the lead.
  expect(router.push).not.toHaveBeenCalled();
});

test("the suspects banner links to the review queue", async () => {
  renderScreen(<PipelineScreen />);
  const banner = await screen.findByRole("link", {
    name: "1 suspect is waiting for review",
  });
  expect(banner.getAttribute("href")).toBe("/review-queue");
});

test("a failed load shows the error state, and Try again loads the leads", async () => {
  api.fail("GET", /^\/api\/leads$/, 500, { once: true });
  renderScreen(<PipelineScreen />);
  await screen.findByText("The leads could not be loaded");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await loaded();
  expect(names()).toHaveLength(5);
});

test("with no leads at all, the empty state is the registry's", async () => {
  viewAs("rep");
  const { updateLead } = await import("@/test/lead-store");
  for (const id of ["lead-imogen", "lead-desmond"]) {
    updateLead(id, { owner: null });
  }
  renderScreen(<PipelineScreen />);
  await screen.findByText("No leads yet");
  expect(
    screen.getByText("New form fills land here automatically."),
  ).toBeDefined();
});

test("the navbar's lead search lands here: its words narrow the list and Clear search takes them out", async () => {
  startDashboard("/leads?q=desmond");
  renderScreen(<PipelineScreen />);
  await loaded();
  expect(names()).toEqual(["Desmond Achterberg"]);
  expect(screen.getByText("Leads matching “desmond”")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(address()).toBe("/leads");
  await waitFor(() => expect(names()).toHaveLength(5));
});
