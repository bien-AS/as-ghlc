import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { listMembers, removeMember, revokeInvite } from "@/lib/data/members";
import { ROLE_LABEL, ROLE_SEES, ROLES } from "@/lib/roles";
import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";

import { UsersScreen } from "./users-screen";

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

beforeEach(() => startDashboard("/dashboard/users"));
afterEach(() => {
  cleanup();
  stopDashboard();
});

const JONAS = "jonas.weber@northgate.example";

async function open(role: "owner" | "admin" | "staff" = "admin") {
  viewAs(role);
  renderScreen(<UsersScreen />);
  if (role !== "staff") await screen.findByText("Maya Okafor");
}
const rows = () =>
  within(
    screen.getByRole("region", { name: /^People with access/ }),
  ).getAllByRole("listitem");
const row = (who: string) => {
  const found = rows().find((item) => within(item).queryByText(who));
  if (!found) throw new Error(`no row for ${who}`);
  return found;
};
const roleOf = (who: string) =>
  screen.getByRole<HTMLSelectElement>("combobox", { name: `Role for ${who}` });
const button = (name: string | RegExp) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const confirm = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name }),
  );
const stored = async (who: string) =>
  (await listMembers()).find(
    (member) => member.name === who || member.email === who,
  );
function invite(email: string, role?: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  if (role) {
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: role },
    });
  }
  fireEvent.click(button("Send invite"));
}

test("lists you first, then the people with access and their roles, then pending invites with the word Pending and when each was sent", async () => {
  await open("admin");

  expect(
    screen.getByRole("heading", { level: 1, name: "Users and roles" }),
  ).toBeTruthy();
  const listed = rows();
  expect(listed).toHaveLength(9);
  expect(screen.getByText("People with access (9)")).toBeTruthy();

  // You, with the role being previewed, which is not changed here.
  expect(within(listed[0]).getByText("Ada Lovelace")).toBeTruthy();
  expect(within(listed[0]).getByText("You")).toBeTruthy();
  expect(roleOf("Ada Lovelace").value).toBe("admin");
  expect(roleOf("Ada Lovelace").disabled).toBe(true);
  expect(within(listed[0]).getByText(/Your role follows/)).toBeTruthy();
  expect(within(listed[0]).queryByRole("button")).toBeNull();

  expect(roleOf("Maya Okafor").value).toBe("staff");
  expect(roleOf("Samir Haddad").value).toBe("admin");
  expect(
    within(row("Maya Okafor")).getByText("maya.okafor@northgate.example"),
  ).toBeTruthy();

  // Invites come last, each with its word and its dates.
  for (const item of listed.slice(-2)) {
    expect(within(item).getByText("Pending")).toBeTruthy();
    expect(item.textContent).toMatch(/Invite sent Oct \d, 2026, expires Oct/);
  }
  expect(row(JONAS).textContent).toContain(
    "Invite sent Oct 5, 2026, expires Oct 12, 2026",
  );
  expect(screen.getAllByText("Pending")).toHaveLength(2);

  expect(screen.getByText("Sample data: no email is sent.")).toBeTruthy();
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("explains what each role sees from the one roles table, says it is proposed, and links to Workspace settings for the allowed domains", async () => {
  await open("owner");

  const panel = screen.getByRole("region", { name: "What each role sees" });
  for (const role of ROLES) {
    expect(within(panel).getByText(ROLE_LABEL[role])).toBeTruthy();
    expect(within(panel).getByText(ROLE_SEES[role])).toBeTruthy();
  }
  expect(panel.textContent).toContain("proposed and not decided yet");
  expect(panel.textContent).toContain("may join without an invite");
  expect(
    within(panel)
      .getByRole("link", { name: "Workspace settings" })
      .getAttribute("href"),
  ).toBe("/dashboard/settings");
});

test("viewed as Staff: the not-allowed state, no list and no invite form, and the API refused", async () => {
  await open("staff");

  await screen.findByText("You do not have access to this screen");
  expect(screen.queryByText(/^People with access/)).toBeNull();
  expect(screen.queryByLabelText("Email")).toBeNull();
  expect(screen.queryByText("Maya Okafor")).toBeNull();
  expect(screen.getByRole("link", { name: "Go to the Pipeline" })).toBeTruthy();
  expect(api.calls()).toEqual(["GET /api/members"]);
});

test("when the server has already refused, the screen says so without asking again", async () => {
  viewAs("staff");
  renderScreen(<UsersScreen notAllowed />);

  expect(
    screen.getByText("You do not have access to this screen"),
  ).toBeTruthy();
  expect(api.calls()).toEqual([]);
});

test("shows skeleton rows while loading, and an error with Try again that loads the list", async () => {
  viewAs("owner");
  api.fail("GET", /^\/api\/members$/, 500, { once: true });
  const release = api.hold("GET", /^\/api\/members$/);
  renderScreen(<UsersScreen />);

  // The first answer is the failure; the retry is the one held open.
  await screen.findByText("The list of people could not be loaded");
  fireEvent.click(button("Try again"));
  release();
  await screen.findByText("Maya Okafor");
  expect(
    screen.queryByText("The list of people could not be loaded"),
  ).toBeNull();

  cleanup();
  const hold = api.hold("GET", /^\/api\/members$/);
  renderScreen(<UsersScreen />);
  expect(screen.getByRole("status", { name: "Loading people" })).toBeTruthy();
  expect(screen.queryByRole("listitem")).toBeNull();
  hold();
  await screen.findByText("Maya Okafor");
  expect(screen.queryByRole("status", { name: "Loading people" })).toBeNull();
});

test("changing a role saves on change, shows the row saving, and the new role is stored", async () => {
  await open("admin");
  const release = api.hold("PATCH", /^\/api\/members\//);

  fireEvent.change(roleOf("Maya Okafor"), { target: { value: "admin" } });

  await within(row("Maya Okafor")).findByText("Saving the role…");
  expect(row("Maya Okafor").getAttribute("aria-busy")).toBe("true");
  expect(roleOf("Maya Okafor").value).toBe("admin");
  expect(roleOf("Maya Okafor").disabled).toBe(true);
  expect(button("Remove Maya Okafor").disabled).toBe(true);
  // Nothing is assumed before the server answers.
  expect((await stored("Maya Okafor"))?.role).toBe("staff");

  release();
  await waitFor(() =>
    expect(row("Maya Okafor").getAttribute("aria-busy")).toBeNull(),
  );
  expect(roleOf("Maya Okafor").value).toBe("admin");
  expect(roleOf("Maya Okafor").disabled).toBe(false);
  expect((await stored("Maya Okafor"))?.role).toBe("admin");

  // An invite's role is changed the same way.
  fireEvent.change(roleOf(JONAS), { target: { value: "admin" } });
  await waitFor(async () => expect((await stored(JONAS))?.role).toBe("admin"));
});

test("a refused role change puts the old value back and says why", async () => {
  await open("admin");

  api.fail("PATCH", /^\/api\/members\//, 409, { once: true });
  fireEvent.change(roleOf("Daniel Reyes"), { target: { value: "owner" } });
  const refused = await within(row("Daniel Reyes")).findByRole("alert");
  expect(refused.textContent).toBe(
    "The role was not changed. A Workspace must keep at least one owner.",
  );
  expect(roleOf("Daniel Reyes").value).toBe("staff");
  expect((await stored("Daniel Reyes"))?.role).toBe("staff");

  api.fail("PATCH", /^\/api\/members\//, 500, { once: true });
  fireEvent.change(roleOf("Daniel Reyes"), { target: { value: "admin" } });
  await within(row("Daniel Reyes")).findByText(
    "The role was not changed. Try again.",
  );
  expect(roleOf("Daniel Reyes").value).toBe("staff");

  // The next change on the row withdraws the message.
  fireEvent.change(roleOf("Daniel Reyes"), { target: { value: "admin" } });
  await waitFor(() => expect(roleOf("Daniel Reyes").value).toBe("admin"));
  await waitFor(() =>
    expect(within(row("Daniel Reyes")).queryByRole("alert")).toBeNull(),
  );
});

test("the last owner's role and Remove are disabled with the reason; a second owner frees them", async () => {
  await open("admin");

  const helena = row("Helena Brandt");
  expect(roleOf("Helena Brandt").value).toBe("owner");
  expect(roleOf("Helena Brandt").disabled).toBe(true);
  expect(button("Remove Helena Brandt").disabled).toBe(true);
  const reason = within(helena).getByText(/^The only owner\./);
  expect(roleOf("Helena Brandt").getAttribute("aria-describedby")).toBe(
    reason.id,
  );

  fireEvent.change(roleOf("Samir Haddad"), { target: { value: "owner" } });
  await waitFor(() => expect(roleOf("Helena Brandt").disabled).toBe(false));
  expect(button("Remove Helena Brandt").disabled).toBe(false);
  expect(within(row("Helena Brandt")).queryByText(/The only owner/)).toBeNull();
});

test("Remove asks first, naming the person and saying they lose access at once; Cancel changes nothing", async () => {
  await open("owner");

  fireEvent.click(button("Remove Tom Lindqvist"));
  const dialog = screen.getByRole("alertdialog", {
    name: "Remove Tom Lindqvist?",
  });
  expect(dialog.textContent).toContain(
    "Tom Lindqvist loses access to this Workspace at once.",
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(await stored("Tom Lindqvist")).toBeTruthy();
  expect(api.calls().filter((call) => call.startsWith("DELETE"))).toEqual([]);

  fireEvent.click(button("Remove Tom Lindqvist"));
  confirm("Remove");
  await screen.findByText("Removed Tom Lindqvist");
  await waitFor(() => expect(rows()).toHaveLength(8));
  expect(screen.queryByText("tom.lindqvist@northgate.example")).toBeNull();
  expect(await stored("Tom Lindqvist")).toBeUndefined();
  expect(screen.getByText("People with access (8)")).toBeTruthy();
});

test("a removal that fails leaves the person listed and says so on their row", async () => {
  await open("owner");
  api.fail("DELETE", /^\/api\/members\//);

  fireEvent.click(button("Remove Priya Nair"));
  confirm("Remove");
  await within(row("Priya Nair")).findByText(
    "Priya Nair was not removed. Try again.",
  );
  expect(await stored("Priya Nair")).toBeTruthy();
});

test("a pending invite can be sent again, which moves its dates, and revoked after confirming", async () => {
  await open("admin");

  vi.setSystemTime(new Date("2026-10-09T12:00:00.000Z"));
  fireEvent.click(button(`Send the invite to ${JONAS} again`));
  await screen.findByText(`Invite recorded again for ${JONAS}`);
  await waitFor(() =>
    expect(row(JONAS).textContent).toContain(
      "Invite sent Oct 9, 2026, expires Oct 16, 2026",
    ),
  );
  expect((await stored(JONAS))?.invitedAt).toBe("2026-10-09T12:00:00.000Z");

  fireEvent.click(button(`Revoke the invite for ${JONAS}`));
  expect(
    screen.getByRole("alertdialog", {
      name: `Revoke the invite for ${JONAS}?`,
    }).textContent,
  ).toContain("stops working at once");
  confirm("Revoke invite");
  await screen.findByText(`Invite revoked for ${JONAS}`);
  await waitFor(() => expect(rows()).toHaveLength(8));
  expect(await stored(JONAS)).toBeUndefined();
  expect(screen.getAllByText("Pending")).toHaveLength(1);
});

test("inviting adds a pending row with the chosen role, empties the form, and keeps saying no email is sent", async () => {
  await open("admin");

  invite("  New.Rep@Northgate.example ", "admin");
  await screen.findByText("Invite recorded for new.rep@northgate.example");

  await waitFor(() => expect(rows()).toHaveLength(10));
  const added = rows()[9];
  expect(within(added).getByText("new.rep@northgate.example")).toBeTruthy();
  expect(within(added).getByText("Pending")).toBeTruthy();
  expect(added.textContent).toContain("Invite sent Oct 7, 2026");
  expect(roleOf("new.rep@northgate.example").value).toBe("admin");
  expect(await stored("new.rep@northgate.example")).toMatchObject({
    role: "admin",
    status: "invited",
  });

  expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe("");
  expect(screen.getByLabelText<HTMLSelectElement>("Role").value).toBe("staff");
  expect(screen.getByText("Sample data: no email is sent.")).toBeTruthy();
  expect(
    screen
      .getAllByRole("button")
      .filter((item) => item.matches('[class*="bg-primary"]')),
  ).toEqual([button("Send invite")]);
});

test("the invite form names what is wrong with the address, and editing the field withdraws the error", async () => {
  await open("admin");
  const email = () => screen.getByLabelText<HTMLInputElement>("Email");
  const posts = () =>
    api.calls().filter((call) => call.startsWith("POST")).length;

  fireEvent.click(button("Send invite"));
  expect(screen.getByText("Enter an email address.")).toBeTruthy();
  expect(email().getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(email());

  invite("not-an-address");
  expect(
    screen.getByText("Enter a valid email address, like name@example.com."),
  ).toBeTruthy();
  expect(posts()).toBe(0);

  fireEvent.change(email(), { target: { value: "not-an-address-yet" } });
  expect(screen.queryByText(/Enter a valid email address/)).toBeNull();
  expect(email().getAttribute("aria-invalid")).toBeNull();

  // Someone who already has access, and someone already invited.
  for (const taken of ["Maya.Okafor@northgate.example", JONAS]) {
    invite(taken);
    await screen.findByText(
      "This address already has access or a pending invite.",
    );
    fireEvent.change(email(), { target: { value: "" } });
    expect(screen.queryByText(/already has access/)).toBeNull();
  }
  expect(rows()).toHaveLength(9);
});

test("an invite that could not be sent keeps the address and says so", async () => {
  await open("owner");
  api.fail("POST", /^\/api\/members\/invites$/, 500, { once: true });

  invite("late@northgate.example");
  await screen.findByText(
    "The invite could not be sent. The address is still here; try again.",
  );
  expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe(
    "late@northgate.example",
  );
  expect(await stored("late@northgate.example")).toBeUndefined();

  fireEvent.click(button("Send invite"));
  await screen.findByText("Invite recorded for late@northgate.example");
  expect(screen.queryByText(/could not be sent/)).toBeNull();
});

test("with nobody else: You are the only person here, with a way to the invite form", async () => {
  viewAs("owner");
  for (const member of await listMembers()) {
    if (member.isViewer) continue;
    await (member.status === "invited"
      ? revokeInvite(member.id)
      : removeMember(member.id));
  }

  renderScreen(<UsersScreen />);
  await screen.findByText(/^You are the only person here\./);
  expect(rows()).toHaveLength(1);
  expect(screen.getByText("People with access (1)")).toBeTruthy();

  fireEvent.click(button("Invite someone"));
  expect(document.activeElement).toBe(screen.getByLabelText("Email"));

  invite("first@northgate.example");
  await waitFor(() => expect(rows()).toHaveLength(2));
  expect(screen.queryByText(/You are the only person here/)).toBeNull();
});
