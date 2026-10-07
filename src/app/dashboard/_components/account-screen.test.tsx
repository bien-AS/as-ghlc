import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getAccountPreferences } from "@/lib/data/account";
import { getUnreadCount, listNotifications } from "@/lib/data/notifications";
import { meQueryOptions } from "@/lib/queries/me";
import {
  ada,
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";
import { field, press, resetClientFakes, type } from "@/test/render";
import { fake } from "@/test/server-fakes";

import { AccountScreen } from "./account-screen";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);
vi.mock(
  "@/lib/supabase/client",
  async () => (await import("@/test/render")).supabaseClientModule,
);
vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationModule,
);
vi.mock(
  "@/lib/navigate",
  async () => (await import("@/test/render")).navigateModule,
);

beforeEach(() => {
  startDashboard("/dashboard/account");
  resetClientFakes();
});
afterEach(() => {
  cleanup();
  stopDashboard();
  localStorage.clear();
  document.documentElement.className = "";
});

const PROFILE = /^\/api\/profile$/;
const PREFERENCES = /^\/api\/account\/preferences$/;
const panel = (name: string) =>
  screen.getByRole("heading", { name }).closest("section") as HTMLElement;
const toggle = (name: string) => screen.getByRole("switch", { name });
const loaded = async () => {
  await screen.findByLabelText("First name");
  await screen.findByRole("switch", { name: "Proposal signed" });
};
const writes = () =>
  api.calls().filter((call) => /^(PATCH|PUT|POST)/.test(call));

test("shows the person's own name and email, the theme, and a switch per notification type", async () => {
  renderScreen(<AccountScreen />);
  await loaded();

  expect(
    screen.getByRole("heading", { name: "Account settings", level: 1 }),
  ).toBeDefined();
  expect(field("First name").value).toBe("Ada");
  expect(field("Last name").value).toBe("Lovelace");
  // The email is shown, never edited and never submitted.
  expect(field("Email").value).toBe("ada@example.com");
  expect(field("Email").readOnly).toBe(true);
  expect(field("Email").getAttribute("name")).toBeNull();

  const theme = within(panel("Theme"));
  expect(theme.getByRole("group", { name: "Theme" })).toBeDefined();
  expect(theme.getByText("Your choice is kept in this browser.")).toBeDefined();

  expect(
    screen.getAllByRole("switch").map((item) => [
      item.getAttribute("aria-checked"),
      // Each switch is named by its type and described by when it is raised.
      document.getElementById(item.getAttribute("aria-labelledby") ?? "")
        ?.textContent,
    ]),
  ).toEqual([
    ["true", "Suspect to review"],
    ["true", "Proposal signed"],
    ["true", "Invoice draft ready"],
  ]);
  expect(
    document.getElementById(
      toggle("Proposal signed").getAttribute("aria-describedby") ?? "",
    )?.textContent,
  ).toBe("When a lead signs its proposal.");

  // What is real and what is sample data is said in words on the screen.
  expect(screen.getByText(/This is your real profile/)).toBeDefined();
  expect(
    within(panel("Notification preferences")).getByText(/^Sample data:/),
  ).toBeDefined();
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("saving the name updates the profile and the name the user menu reads, and says Saved until the next edit", async () => {
  const { queryClient } = renderScreen(<AccountScreen />);
  await loaded();

  type("First name", "  Augusta ");
  type("Last name", "King");
  press("Save name");

  expect(await screen.findByText("Saved.")).toBeDefined();
  expect(writes()).toEqual(["PATCH /api/profile"]);
  expect(fake.users.get(ada.id)).toEqual({
    ...ada,
    firstName: "Augusta",
    lastName: "King",
  });
  expect(queryClient.getQueryData(meQueryOptions.queryKey)).toMatchObject({
    firstName: "Augusta",
    lastName: "King",
  });

  type("Last name", "Byron");
  expect(screen.queryByText("Saved.")).toBeNull();
});

test("an empty name is refused on the form, with the field named, and nothing is sent", async () => {
  renderScreen(<AccountScreen />);
  await loaded();

  type("First name", "   ");
  press("Save name");

  expect(await screen.findByText("Enter your first name.")).toBeDefined();
  expect(field("First name").getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(field("First name"));
  expect(writes()).toEqual([]);

  // Editing the field withdraws its error.
  type("First name", "Augusta");
  expect(screen.queryByText("Enter your first name.")).toBeNull();
});

test("if the name cannot be saved, the form says so and keeps what was typed", async () => {
  renderScreen(<AccountScreen />);
  await loaded();
  api.fail("PATCH", PROFILE);

  type("First name", "Augusta");
  press("Save name");

  expect((await screen.findByRole("alert")).textContent).toContain(
    "We could not save your name. Try again.",
  );
  expect(field("First name").value).toBe("Augusta");
  expect(screen.queryByText("Saved.")).toBeNull();
  expect(fake.users.get(ada.id)).toEqual(ada);
});

test("choosing a theme applies it and keeps it in this browser", async () => {
  renderScreen(<AccountScreen />);
  await loaded();

  fireEvent.click(within(panel("Theme")).getByRole("radio", { name: "Dark" }));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("theme")).toBe("dark");
  expect(writes()).toEqual([]);
});

test("switching a type off saves it, and that type leaves the person's notifications and unread count", async () => {
  const before = (await listNotifications({ limit: 100 })).items;
  renderScreen(<AccountScreen />);
  await loaded();

  fireEvent.click(toggle("Suspect to review"));
  await waitFor(() =>
    expect(toggle("Suspect to review").getAttribute("aria-checked")).toBe(
      "false",
    ),
  );
  await waitFor(() =>
    expect(writes()).toEqual(["PUT /api/account/preferences"]),
  );
  await waitFor(async () =>
    expect(await getAccountPreferences()).toEqual({
      notifications: {
        suspect_to_review: false,
        proposal_signed: true,
        invoice_draft_ready: true,
      },
    }),
  );
  expect(toggle("Proposal signed").getAttribute("aria-checked")).toBe("true");

  const kept = before.filter((item) => item.type !== "suspect_to_review");
  expect((await listNotifications({ limit: 100 })).items).toEqual(kept);
  expect(await getUnreadCount()).toEqual({
    count: kept.filter((item) => !item.read).length,
  });

  // And back on again.
  fireEvent.click(toggle("Suspect to review"));
  await waitFor(async () =>
    expect((await listNotifications({ limit: 100 })).items).toEqual(before),
  );
  expect(toggle("Suspect to review").getAttribute("aria-checked")).toBe("true");
});

test("if a choice cannot be saved, the switch returns to where it was and the panel says so", async () => {
  renderScreen(<AccountScreen />);
  await loaded();
  api.fail("PUT", PREFERENCES);

  fireEvent.click(toggle("Invoice draft ready"));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "That choice could not be saved. Try again.",
  );
  expect(toggle("Invoice draft ready").getAttribute("aria-checked")).toBe(
    "true",
  );
  expect((await getAccountPreferences()).notifications).toMatchObject({
    invoice_draft_ready: true,
  });
});

test("while the preferences load a skeleton stands in; if they cannot be loaded, Try again loads them", async () => {
  api.fail("GET", PREFERENCES);
  renderScreen(<AccountScreen />);
  expect(
    screen.getByRole("status", { name: "Loading preferences" }),
  ).toBeDefined();
  expect(screen.getByRole("status", { name: "Loading profile" })).toBeDefined();

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Your preferences could not be loaded");
  // The rest of the screen does not depend on it.
  expect(
    (await screen.findByLabelText<HTMLInputElement>("First name")).value,
  ).toBe("Ada");

  api.restore();
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByRole("switch", { name: "Proposal signed" }),
  ).toBeDefined();
});

test("viewed as Staff, account settings are the same: they are personal, not the Workspace's", async () => {
  viewAs("staff");
  renderScreen(<AccountScreen />);
  await loaded();

  expect(screen.queryByText(/do not have access/)).toBeNull();
  expect(screen.getAllByRole("switch")).toHaveLength(3);
  type("First name", "Augusta");
  press("Save name");
  expect(await screen.findByText("Saved.")).toBeDefined();
  expect(fake.users.get(ada.id)?.firstName).toBe("Augusta");
});
