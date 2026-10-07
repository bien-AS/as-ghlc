import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getWorkspace } from "@/lib/data/workspace";
import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";

import { WorkspaceScreen } from "./workspace-screen";

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

beforeEach(() => startDashboard("/dashboard/settings"));
afterEach(() => {
  cleanup();
  stopDashboard();
});

async function open() {
  renderScreen(<WorkspaceScreen />);
  await screen.findByLabelText("Name");
}
const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const button = (name: string | RegExp) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const preview = () =>
  screen.getByRole("figure", { name: "Branding preview" }).textContent;
const domains = () =>
  within(screen.getByRole("list", { name: "Allowed email domains" }))
    .getAllByRole("listitem")
    .map((item) => item.querySelector("span")?.textContent);
const writes = () => api.calls().filter((call) => !call.startsWith("GET"));

test("shows the Workspace's name, its branding with a preview, and who can join, with one primary action", async () => {
  await open();

  expect(
    screen.getByRole("heading", { level: 1, name: "Workspace settings" }),
  ).toBeDefined();
  expect(
    screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual(["Workspace", "Branding", "Who can join"]);

  expect(field("Name").value).toBe("Authority Solutions");
  expect(field("Display name").value).toBe("Authority Solutions");
  expect(field("Logo initials").value).toBe("AS");
  expect(preview()).toBe("PreviewASAuthority Solutions");
  expect(domains()).toEqual(["authoritysolutions.com"]);

  // The three marked choices, each said once in plain words.
  expect(
    screen.getByText(/apart from every other customer's/).textContent,
  ).toMatch(/A Workspace cannot be created or deleted here\.$/);
  expect(
    screen.getByText(/The look of Dealwright itself does not change\./),
  ).toBeDefined();
  expect(
    screen.getByText(/on an allowed domain, or who have an invite, may join/),
  ).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Users and roles" }).getAttribute("href"),
  ).toBe("/dashboard/users");

  const primary = screen
    .getAllByRole("button")
    .filter((control) => control.className.includes("bg-primary"));
  expect(primary.map((control) => control.textContent)).toEqual([
    "Save changes",
  ]);
  // Hydrated in the test, so the form's submit is live.
  expect(button("Save changes").disabled).toBe(false);
});

test("names no CRM or outside service by brand, and never says org, tenant or account", async () => {
  await open();
  const text = document.body.textContent ?? "";
  expect(text).not.toMatch(FORBIDDEN);
  expect(text).not.toMatch(/\borg\b|organi[sz]ation|tenant|\baccount\b/i);
});

test("the preview follows the branding fields as they are typed, before anything is saved", async () => {
  await open();
  type("Display name", "Northwind");
  type("Logo initials", "nw");
  expect(preview()).toBe("PreviewNWNorthwind");

  type("Display name", "  ");
  expect(preview()).toBe("PreviewNWNo name yet");
  expect(writes()).toEqual([]);
});

test("Save changes saves the name and branding, says so, and a later read has them", async () => {
  await open();
  type("Name", " Northwind Sales ");
  type("Display name", "Northwind");
  type("Logo initials", "nw");
  fireEvent.click(button("Save changes"));

  await screen.findByText("Workspace settings saved");
  expect(writes()).toEqual(["PUT /api/workspace"]);
  expect(await getWorkspace()).toMatchObject({
    name: "Northwind Sales",
    branding: { displayName: "Northwind", logoInitials: "NW" },
    allowedDomains: ["authoritysolutions.com"],
  });
});

test("an invalid field says what is wrong under it, takes focus, sends nothing, and clears when edited", async () => {
  await open();
  type("Name", "  ");
  type("Logo initials", "ABCD");
  fireEvent.click(button("Save changes"));

  expect(screen.getByText("Enter the Workspace's name.")).toBeDefined();
  expect(screen.getByText("Use 1 to 3 letters or numbers.")).toBeDefined();
  expect(field("Name").getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(field("Name"));
  expect(writes()).toEqual([]);

  type("Name", "Northwind");
  expect(screen.queryByText("Enter the Workspace's name.")).toBeNull();
  expect(screen.getByText("Use 1 to 3 letters or numbers.")).toBeDefined();
});

test("while saving, the button is busy and a second press sends nothing more", async () => {
  await open();
  const release = api.hold("PUT", /^\/api\/workspace$/);
  fireEvent.click(button("Save changes"));

  await waitFor(() =>
    expect(
      button(/^(Loading\s*)?Save changes$/).getAttribute("aria-busy"),
    ).toBe("true"),
  );
  fireEvent.click(button(/^(Loading\s*)?Save changes$/));
  release();
  await screen.findByText("Workspace settings saved");
  expect(writes()).toEqual(["PUT /api/workspace"]);
});

test("a refused save says nothing was changed, and nothing was", async () => {
  await open();
  api.fail("PUT", /^\/api\/workspace$/);
  type("Name", "Northwind");
  fireEvent.click(button("Save changes"));

  await screen.findByText("That did not save. Nothing was changed. Try again.");
  expect((await getWorkspace()).name).toBe("Authority Solutions");

  // Trying again, once it works, saves.
  api.restore();
  fireEvent.click(button("Save changes"));
  await screen.findByText("Workspace settings saved");
  expect((await getWorkspace()).name).toBe("Northwind");
});

test("Add domain adds it in lower case, clears the field, and a later read has it", async () => {
  await open();
  type("Email domain", " Northwind.Example ");
  fireEvent.click(button("Add domain"));

  await screen.findByText("Added northwind.example");
  expect(domains()).toEqual(["authoritysolutions.com", "northwind.example"]);
  expect(field("Email domain").value).toBe("");
  expect((await getWorkspace()).allowedDomains).toEqual([
    "authoritysolutions.com",
    "northwind.example",
  ]);
});

test("a malformed domain is caught before it is sent; a duplicate is refused by the server and says so", async () => {
  await open();
  type("Email domain", "ada@northwind.example");
  fireEvent.click(button("Add domain"));
  expect(
    screen.getByText(
      "Enter a domain, like example.com, without @ or https://.",
    ),
  ).toBeDefined();
  expect(writes()).toEqual([]);

  type("Email domain", "AuthoritySolutions.com");
  fireEvent.click(button("Add domain"));
  await screen.findByText("This domain is already allowed.");
  expect(domains()).toEqual(["authoritysolutions.com"]);
  // The field keeps what was typed, so it can be corrected.
  expect(field("Email domain").value).toBe("AuthoritySolutions.com");
});

test("Remove asks first: Cancel changes nothing, confirming removes the domain and shows the empty state", async () => {
  await open();
  fireEvent.click(button("Remove authoritysolutions.com"));
  const dialog = await screen.findByRole("alertdialog", {
    name: "Remove authoritysolutions.com?",
  });
  expect(dialog.textContent).toMatch(
    /will need an invite to join\. People who have already joined keep their access\./,
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(writes()).toEqual([]);

  fireEvent.click(button("Remove authoritysolutions.com"));
  fireEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Remove domain",
    }),
  );
  await screen.findByText(
    "No domain is allowed. People can join only with an invite.",
  );
  expect(writes()).toEqual([
    "DELETE /api/workspace/domains/authoritysolutions.com",
  ]);
  expect((await getWorkspace()).allowedDomains).toEqual([]);
});

test("a refused removal says so and the domain stays", async () => {
  await open();
  api.fail("DELETE", /^\/api\/workspace\/domains\//);
  fireEvent.click(button("Remove authoritysolutions.com"));
  fireEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Remove domain",
    }),
  );
  await screen.findByText(
    "That domain could not be removed. Nothing was changed. Try again.",
  );
  expect(domains()).toEqual(["authoritysolutions.com"]);
});

test("Staff are told they do not have access, whether the server page or the API refused", async () => {
  viewAs("staff");
  const first = renderScreen(<WorkspaceScreen />);
  await screen.findByText("You do not have access to this screen");
  expect(screen.queryByLabelText("Name")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Back to the Pipeline" })
      .getAttribute("href"),
  ).toBe("/dashboard");
  expect(api.calls()).toEqual(["GET /api/workspace"]);
  first.unmount();

  // The page already knows: the screen asks for nothing.
  vi.mocked(fetch).mockClear();
  renderScreen(<WorkspaceScreen notAllowed />);
  expect(
    screen.getByText("You do not have access to this screen"),
  ).toBeDefined();
  expect(
    screen.getByRole("heading", { level: 1, name: "Workspace settings" }),
  ).toBeDefined();
  expect(api.calls()).toEqual([]);
});

test.each(["admin", "owner"] as const)("%s sees the settings", async (role) => {
  viewAs(role);
  await open();
  expect(field("Name").value).toBe("Authority Solutions");
});

test("shows a skeleton while loading, and an error with Try again when the read fails", async () => {
  const release = api.hold("GET", /^\/api\/workspace$/);
  renderScreen(<WorkspaceScreen />);
  expect(
    screen.getByRole("status", { name: "Loading Workspace settings" }),
  ).toBeDefined();
  release();
  await screen.findByLabelText("Name");
  cleanup();

  api.fail("GET", /^\/api\/workspace$/, 500, { once: true });
  renderScreen(<WorkspaceScreen />);
  await screen.findByText("The Workspace settings could not be loaded");
  fireEvent.click(button("Try again"));
  await screen.findByLabelText("Name");
});
