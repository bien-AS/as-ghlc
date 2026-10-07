import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { CRM_PROVIDERS, FIXED_PROVIDERS } from "@/lib/connections/providers";
import {
  disconnect,
  getStageMapping,
  listConnections,
} from "@/lib/data/connections";
import { listVisibleLeads } from "@/lib/data/leads";
import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";

import { IntegrationsScreen } from "./integrations-screen";

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

beforeEach(() => startDashboard("/dashboard/integrations"));
afterEach(() => {
  cleanup();
  stopDashboard();
});

// The names come from the provider table: this file writes no brand either.
const CRM = CRM_PROVIDERS[0].name;
const PLANNED = CRM_PROVIDERS[1].name;
const { proposals, invoices, decks } = FIXED_PROVIDERS;
const KEY = "sk-sample-DO-NOT-KEEP-7f3a91";

async function open() {
  renderScreen(<IntegrationsScreen />);
  await screen.findByRole("region", { name: "CRM" });
}
const panel = (name: string) => within(screen.getByRole("region", { name }));
/** The Connection panels, by their headings (the toast area is a region too). */
const panels = () =>
  [...document.querySelectorAll('[data-slot="panel-section"]')].map((section) =>
    section.getAttribute("aria-label"),
  );
const chip = (name: string) =>
  screen.getByRole("region", { name }).querySelector('p [data-slot="badge"]')
    ?.textContent;
const primary = () =>
  screen
    .getAllByRole("button")
    .filter((control) => control.className.includes("bg-primary"))
    .map((control) => control.textContent);
const writes = () => api.calls().filter((call) => !call.startsWith("GET"));
const confirm = async (name: string) =>
  fireEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name,
    }),
  );
const statusOf = async (type: string) =>
  (await listConnections()).find((connection) => connection.type === type)
    ?.status;

test("one panel per Connection type, in order, each with its provider, a status word and when it last synced", async () => {
  await open();

  expect(
    screen.getByRole("heading", { level: 1, name: "Integrations" }),
  ).toBeDefined();
  expect(panels()).toEqual(["CRM", "Proposals", "Invoices", "Decks"]);

  expect(
    ["CRM", "Proposals", "Invoices", "Decks"].map(
      (name) =>
        screen.getByRole("region", { name }).querySelector("p > span")
          ?.textContent,
    ),
  ).toEqual([CRM, proposals.name, invoices.name, decks.name]);

  expect(["CRM", "Proposals", "Invoices", "Decks"].map(chip)).toEqual([
    "Connected",
    "Connected",
    "Not connected",
    "Connected",
  ]);

  // Synced four minutes before noon UTC on 7 October, in the viewer's zone.
  expect(
    panel("CRM")
      .getByText(/^Last synced/)
      .querySelector("time")?.dateTime,
  ).toBe("2026-10-07T11:56:00.000Z");
  expect(panel("Decks").getByText(/^Last synced/)).toBeDefined();
  expect(panel("Invoices").queryByText(/Last synced|Not synced/)).toBeNull();
});

test("this is the screen that names providers by brand; the sample CRM is connected and in sync", async () => {
  await open();
  expect(document.body.textContent).toMatch(FORBIDDEN);
  expect(document.body.textContent).not.toMatch(/ASCRM/);
});

test("the one primary action is the CRM's: Sync now while connected, Connect once it is not", async () => {
  await open();
  expect(primary()).toEqual(["Sync now"]);

  fireEvent.click(
    panel("CRM").getByRole("button", { name: `Disconnect ${CRM}` }),
  );
  await confirm("Disconnect");
  await waitFor(() => expect(chip("CRM")).toBe("Not connected"));
  expect(primary()).toEqual(["Connect"]);
  expect(
    panel("CRM").getByRole("button", { name: `Connect ${CRM}` }).className,
  ).toContain("bg-primary");
  // The invoice service's Connect stays a neutral button.
  expect(
    panel("Invoices").getByRole("button", { name: `Connect ${invoices.name}` })
      .className,
  ).not.toContain("bg-primary");
});

test("the three tools are fixed and offer no choice; the CRM lists one available and one planned", async () => {
  await open();
  for (const name of ["Proposals", "Invoices", "Decks"]) {
    expect(
      panel(name).getByText("This service is fixed in the first version."),
    ).toBeDefined();
    expect(panel(name).queryByRole("combobox")).toBeNull();
  }
  expect(
    panel("CRM").queryByText("This service is fixed in the first version."),
  ).toBeNull();

  const list = within(
    panel("CRM").getByRole("heading", { name: "CRMs Dealwright connects to" })
      .parentElement as HTMLElement,
  ).getAllByRole("listitem");
  expect(list.map((item) => item.textContent)).toEqual([
    `${CRM}Available`,
    `${PLANNED}Planned`,
  ]);
  // Planned is a warn chip with its word, and nothing connects to it.
  expect(list[1].querySelector('[data-slot="badge"]')?.className).toContain(
    "bg-warn-soft",
  );
  expect(
    screen.queryByRole("button", { name: new RegExp(PLANNED) }),
  ).toBeNull();
});

test("Sync now shows Syncing while the request runs, then Connected with the new time", async () => {
  await open();
  vi.setSystemTime(new Date("2026-10-07T12:20:00.000Z"));
  const release = api.hold("POST", /\/api\/connections\/crm\/sync$/);
  fireEvent.click(panel("CRM").getByRole("button", { name: "Sync now" }));

  await waitFor(() => expect(chip("CRM")).toBe("Syncing"));
  const busy = panel("CRM").getByRole("button", {
    name: /^(Loading\s*)?Sync now$/,
  });
  expect(busy.getAttribute("aria-busy")).toBe("true");
  // A second press while it runs sends nothing more.
  fireEvent.click(busy);

  release();
  await waitFor(() => expect(chip("CRM")).toBe("Connected"));
  expect(
    panel("CRM")
      .getByText(/^Last synced/)
      .querySelector("time")?.dateTime,
  ).toBe("2026-10-07T12:20:00.000Z");
  expect(writes()).toEqual(["POST /api/connections/crm/sync"]);
});

test("Import leads reports the counts as a plain line: every sample lead already here, none added", async () => {
  const leads = (await listVisibleLeads()).length;
  await open();
  expect(
    panel("CRM").getByText(/Sample data: nothing is contacted\./),
  ).toBeDefined();

  fireEvent.click(panel("CRM").getByRole("button", { name: "Import leads" }));
  await panel("CRM").findByText(
    `Import finished: ${leads} found, 0 added, ${leads} already here.`,
  );
  // Running it again adds nothing either (spec 09, rule 1).
  fireEvent.click(panel("CRM").getByRole("button", { name: "Import leads" }));
  await waitFor(() =>
    expect(writes()).toEqual([
      "POST /api/connections/crm/import",
      "POST /api/connections/crm/import",
    ]),
  );
  expect((await listVisibleLeads()).length).toBe(leads);
});

test("Map stages: each of the six stages has a labelled select of the CRM's stages; Save shows in a later read", async () => {
  await open();
  expect(
    panel("CRM").getByText(
      new RegExp(`owns a lead's stage and pushes it out to ${CRM}\\.`),
    ),
  ).toBeDefined();

  const selects = panel("CRM").getAllByRole<HTMLSelectElement>("combobox");
  expect(selects.map((select) => select.labels?.[0]?.textContent)).toEqual([
    "New lead",
    "Discovery Call Booked",
    "Qualified",
    "Proposal Review Booked",
    "Proposal Sent",
    "Lead Won",
  ]);
  expect(selects.map((select) => select.value)).toEqual([
    "New Lead",
    "Discovery Session Booked",
    "Qualified",
    "Proposal Review Booked",
    "Proposal Sent",
    "Won",
  ]);
  expect(selects[0].options).toHaveLength(7);

  fireEvent.change(panel("CRM").getByLabelText("Lead Won"), {
    target: { value: "Nurture" },
  });
  fireEvent.click(
    panel("CRM").getByRole("button", { name: "Save stage mapping" }),
  );
  await screen.findByText("Stage mapping saved");
  expect(writes()).toEqual(["PUT /api/connections/crm/stage-mapping"]);
  expect((await getStageMapping()).mapping.won).toBe("Nurture");
  expect(panel("CRM").getByLabelText<HTMLSelectElement>("Lead Won").value).toBe(
    "Nurture",
  );
});

test("mock connect: a password field that is not filled in for you, a line saying the key goes nowhere, and an empty key is caught", async () => {
  await open();
  const field = panel("Invoices").getByLabelText<HTMLInputElement>(
    `${invoices.name} API key`,
  );
  expect(field.type).toBe("password");
  expect(field.autocomplete).toBe("off");
  expect(
    panel("Invoices").getByText(
      "Sample data: the key is not stored and nothing is contacted.",
    ),
  ).toBeDefined();

  fireEvent.click(
    panel("Invoices").getByRole("button", { name: `Connect ${invoices.name}` }),
  );
  expect(panel("Invoices").getByText("Enter the API key.")).toBeDefined();
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(writes()).toEqual([]);

  fireEvent.change(field, { target: { value: "   " } });
  expect(panel("Invoices").queryByText("Enter the API key.")).toBeNull();
  fireEvent.click(
    panel("Invoices").getByRole("button", { name: `Connect ${invoices.name}` }),
  );
  expect(panel("Invoices").getByText("Enter the API key.")).toBeDefined();
  expect(writes()).toEqual([]);
});

test("connecting sends the key once, shows Connected, and the key is nowhere afterwards", async () => {
  const { queryClient } = renderScreen(<IntegrationsScreen />);
  await screen.findByRole("region", { name: "CRM" });

  fireEvent.change(
    panel("Invoices").getByLabelText(`${invoices.name} API key`),
    { target: { value: KEY } },
  );
  fireEvent.click(
    panel("Invoices").getByRole("button", { name: `Connect ${invoices.name}` }),
  );

  await screen.findByText(`Connected ${invoices.name}`);
  expect(chip("Invoices")).toBe("Connected");
  expect(panel("Invoices").getByText(/^Last synced/)).toBeDefined();
  expect(panel("Invoices").queryByLabelText(/API key/)).toBeNull();
  expect(await statusOf("invoices")).toBe("connected");

  // Sent in one request body, and in nothing that came back or stayed.
  const sent = vi
    .mocked(fetch)
    .mock.calls.filter(([, init]) => String(init?.body ?? "").includes(KEY));
  expect(sent.map(([input, init]) => `${init?.method} ${input}`)).toEqual([
    "POST /api/connections/invoices",
  ]);
  expect(document.body.innerHTML).not.toContain(KEY);
  expect(
    JSON.stringify(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
    ),
  ).not.toContain(KEY);
  await waitFor(() =>
    expect(
      JSON.stringify(
        queryClient
          .getMutationCache()
          .getAll()
          .map((mutation) => mutation.state.variables),
      ),
    ).not.toContain(KEY),
  );
  expect(JSON.stringify(await listConnections())).not.toContain(KEY);
});

test("Disconnect asks first: Cancel changes nothing, confirming shows Not connected and the connect form", async () => {
  await open();
  fireEvent.click(
    panel("Decks").getByRole("button", { name: `Disconnect ${decks.name}` }),
  );
  const dialog = await screen.findByRole("alertdialog", {
    name: `Disconnect ${decks.name}?`,
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(writes()).toEqual([]);

  fireEvent.click(
    panel("Decks").getByRole("button", { name: `Disconnect ${decks.name}` }),
  );
  await confirm("Disconnect");
  await screen.findByText(`Disconnected ${decks.name}`);
  expect(chip("Decks")).toBe("Not connected");
  expect(panel("Decks").getByLabelText(`${decks.name} API key`)).toBeDefined();
  expect(writes()).toEqual(["DELETE /api/connections/decks"]);
  expect(await statusOf("decks")).toBe("not_connected");
});

test("a disconnected CRM offers no sync, import or stage mapping until it is connected again", async () => {
  await open();
  fireEvent.click(
    panel("CRM").getByRole("button", { name: `Disconnect ${CRM}` }),
  );
  await confirm("Disconnect");
  await waitFor(() => expect(chip("CRM")).toBe("Not connected"));

  expect(panel("CRM").queryByRole("button", { name: "Sync now" })).toBeNull();
  expect(
    panel("CRM").queryByRole("button", { name: "Import leads" }),
  ).toBeNull();
  expect(panel("CRM").queryByRole("combobox")).toBeNull();
  // Which CRMs can be connected is still shown.
  expect(panel("CRM").getByText("Planned")).toBeDefined();

  fireEvent.change(panel("CRM").getByLabelText(`${CRM} API key`), {
    target: { value: KEY },
  });
  fireEvent.click(panel("CRM").getByRole("button", { name: `Connect ${CRM}` }));
  await waitFor(() => expect(chip("CRM")).toBe("Connected"));
  expect(panel("CRM").getAllByRole("combobox")).toHaveLength(6);
  expect(primary()).toEqual(["Sync now"]);
});

test("a write that fails says nothing was changed; one refused because the Connection changed says so and shows the latest", async () => {
  await open();
  api.fail("POST", /\/sync$/, 500, { once: true });
  fireEvent.click(panel("CRM").getByRole("button", { name: "Sync now" }));
  await panel("CRM").findByText(
    "That did not go through. Nothing was changed. Try again.",
  );
  expect(chip("CRM")).toBe("Connected");
  expect(
    panel("CRM")
      .getByText(/^Last synced/)
      .querySelector("time")?.dateTime,
  ).toBe("2026-10-07T11:56:00.000Z");

  // Trying again works, and the message goes.
  fireEvent.click(panel("CRM").getByRole("button", { name: "Sync now" }));
  await waitFor(() =>
    expect(
      panel("CRM").queryByText(
        "That did not go through. Nothing was changed. Try again.",
      ),
    ).toBeNull(),
  );

  // Someone else disconnected the deck service meanwhile: the server refuses with 409.
  await disconnect("decks");
  fireEvent.click(
    panel("Decks").getByRole("button", { name: `Disconnect ${decks.name}` }),
  );
  await confirm("Disconnect");
  await panel("Decks").findByText(
    "This Connection changed since you opened the page, so nothing was done. The latest is shown.",
  );
  await waitFor(() => expect(chip("Decks")).toBe("Not connected"));
});

test("Staff are told they do not have access, whether the server page or the API refused", async () => {
  viewAs("staff");
  const first = renderScreen(<IntegrationsScreen />);
  await screen.findByText("You do not have access to this screen");
  expect(panels()).toEqual([]);
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
  expect(
    screen
      .getByRole("link", { name: "Back to the Pipeline" })
      .getAttribute("href"),
  ).toBe("/dashboard");
  expect(api.calls()).toEqual(["GET /api/connections"]);
  first.unmount();

  // The page already knows: the screen asks for nothing.
  vi.mocked(fetch).mockClear();
  renderScreen(<IntegrationsScreen notAllowed />);
  expect(
    screen.getByText("You do not have access to this screen"),
  ).toBeDefined();
  expect(
    screen.getByRole("heading", { level: 1, name: "Integrations" }),
  ).toBeDefined();
  expect(api.calls()).toEqual([]);
});

test.each(["admin", "owner"] as const)(
  "%s sees the Connections",
  async (role) => {
    viewAs(role);
    await open();
    expect(panels()).toHaveLength(4);
  },
);

test("shows a skeleton while loading, and an error with Try again when the read fails", async () => {
  const release = api.hold("GET", /^\/api\/connections$/);
  renderScreen(<IntegrationsScreen />);
  expect(
    screen.getByRole("status", { name: "Loading Connections" }),
  ).toBeDefined();
  release();
  await screen.findByRole("region", { name: "CRM" });
  cleanup();

  api.fail("GET", /^\/api\/connections$/, 500, { once: true });
  renderScreen(<IntegrationsScreen />);
  await screen.findByText("The Connections could not be loaded");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("region", { name: "CRM" });
});
