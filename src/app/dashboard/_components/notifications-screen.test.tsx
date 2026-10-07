import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { updateAccountPreferences } from "@/lib/data/account";
import { listVisibleLeads, recordProposalStatus } from "@/lib/data/leads";
import {
  createNotification,
  getUnreadCount,
  listNotifications,
  markNotificationRead,
} from "@/lib/data/notifications";
import { notificationText } from "@/lib/notifications/rules";
import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";
import { address } from "@/test/navigation";

import { NotificationsScreen } from "./notifications-screen";

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

beforeEach(() => startDashboard("/dashboard/notifications"));
afterEach(() => {
  cleanup();
  stopDashboard();
});

const LIST = /^\/api\/notifications$/;
const READ = /^\/api\/notifications\/[^/]+\/read$/;

const everything = async () => (await listNotifications({ limit: 100 })).items;
const items = () => within(screen.getByRole("list")).getAllByRole("listitem");
const rows = () =>
  within(screen.getByRole("list")).getAllByRole<HTMLAnchorElement>("link");
/** The list item whose row opens this lead and says this. */
const itemFor = (text: string) => {
  const found = items().find((item) => item.textContent?.includes(text));
  if (!found) throw new Error(`no notification saying ${text}`);
  return found;
};
const loaded = () => screen.findByRole("list");

test("lists what happened, the lead's company and when, newest first; each row opens its lead", async () => {
  renderScreen(<NotificationsScreen />);
  await loaded();
  const all = await everything();
  const firstPage = all.slice(0, 10);

  expect(screen.getByRole("heading", { name: "Notifications" })).toBeDefined();
  expect(rows().map((row) => row.getAttribute("href"))).toEqual(
    firstPage.map((item) => `/dashboard/leads/${item.lead.id}`),
  );
  firstPage.forEach((item, index) => {
    const row = within(rows()[index]);
    expect(row.getByText(notificationText(item.type, item.lead))).toBeDefined();
    expect(
      row.getByText(item.lead.company ?? "No company given"),
    ).toBeDefined();
    expect(rows()[index].querySelector("time")?.getAttribute("dateTime")).toBe(
      item.createdAt,
    );
  });

  // No "mark all read" and no deleting (spec 08).
  expect(screen.queryByRole("button", { name: /all/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /delete|remove/i })).toBeNull();
  expect(screen.getByText(/^Sample data:/)).toBeDefined();
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("an unread row says Unread in words and offers Mark read; a read row does neither", async () => {
  renderScreen(<NotificationsScreen />);
  await loaded();
  const firstPage = (await everything()).slice(0, 10);
  expect(firstPage.some((item) => item.read)).toBe(true);
  expect(firstPage.some((item) => !item.read)).toBe(true);

  firstPage.forEach((item, index) => {
    const row = within(items()[index]);
    expect(Boolean(row.queryByText("Unread"))).toBe(!item.read);
    expect(Boolean(row.queryByRole("button", { name: /^Mark read/ }))).toBe(
      !item.read,
    );
  });
  const { count } = await getUnreadCount();
  expect(screen.getByText(`${count} unread`)).toBeDefined();
});

test("Mark read changes the row at once without opening the lead, and the count drops by one", async () => {
  renderScreen(<NotificationsScreen />);
  await loaded();
  const target = (await everything()).find((item) => !item.read);
  const text = notificationText(target?.type ?? "proposal_signed", {
    id: "",
    name: target?.lead.name ?? "",
    company: null,
  });
  const { count } = await getUnreadCount();
  await screen.findByText(`${count} unread`);

  // The request is still open when the row changes.
  const release = api.hold("POST", READ);
  fireEvent.click(
    within(itemFor(text)).getByRole("button", { name: `Mark read: ${text}` }),
  );
  await waitFor(() =>
    expect(within(itemFor(text)).queryByText("Unread")).toBeNull(),
  );
  expect(within(itemFor(text)).queryByRole("button")).toBeNull();
  expect(screen.getByText(`${count - 1} unread`)).toBeDefined();
  // Focus stays on the row instead of being lost with the control.
  expect(document.activeElement).toBe(within(itemFor(text)).getByRole("link"));
  expect(address()).toBe("/dashboard/notifications");

  release();
  await waitFor(() =>
    expect(api.calls()).toContain(`POST /api/notifications/${target?.id}/read`),
  );
  await waitFor(async () =>
    expect(await getUnreadCount()).toEqual({ count: count - 1 }),
  );
  expect(within(itemFor(text)).queryByText("Unread")).toBeNull();
});

test("selecting an unread row marks it read on the way to its lead", async () => {
  renderScreen(<NotificationsScreen />);
  await loaded();
  const all = await everything();
  const index = all.findIndex((item) => !item.read);
  const target = all[index];

  fireEvent.click(rows()[index]);
  await waitFor(() =>
    expect(api.calls()).toContain(`POST /api/notifications/${target?.id}/read`),
  );
  await waitFor(async () =>
    expect(
      (await everything()).find((item) => item.id === target?.id)?.read,
    ).toBe(true),
  );
});

test("selecting a row that is already read asks for nothing", async () => {
  renderScreen(<NotificationsScreen />);
  await loaded();
  const index = (await everything()).findIndex((item) => item.read);

  fireEvent.click(rows()[index]);
  expect(api.calls().filter((call) => call.startsWith("POST"))).toEqual([]);
});

test("if marking read fails, the row returns to unread with a brief message", async () => {
  renderScreen(<NotificationsScreen />);
  await loaded();
  const target = (await everything()).find((item) => !item.read);
  const text = notificationText(target?.type ?? "proposal_signed", {
    id: "",
    name: target?.lead.name ?? "",
    company: null,
  });
  const { count } = await getUnreadCount();
  await screen.findByText(`${count} unread`);

  api.fail("POST", READ);
  fireEvent.click(
    within(itemFor(text)).getByRole("button", { name: /^Mark read/ }),
  );

  expect(
    await screen.findByText("That could not be marked read. Try again."),
  ).toBeDefined();
  await waitFor(() =>
    expect(within(itemFor(text)).getByText("Unread")).toBeDefined(),
  );
  expect(
    within(itemFor(text)).getByRole("button", { name: /^Mark read/ }),
  ).toBeDefined();
  await screen.findByText(`${count} unread`);
  expect(await getUnreadCount()).toEqual({ count });
});

test("a long list loads a page at a time, and more on request", async () => {
  renderScreen(<NotificationsScreen />);
  await loaded();
  const all = await everything();
  expect(all.length).toBeGreaterThan(10);
  expect(rows()).toHaveLength(10);

  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  await waitFor(() => expect(rows()).toHaveLength(all.length));
  expect(rows().map((row) => row.getAttribute("href"))).toEqual(
    all.map((item) => `/dashboard/leads/${item.lead.id}`),
  );
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
});

test("if more cannot be loaded, the rows stay and Try again loads them", async () => {
  renderScreen(<NotificationsScreen />);
  await loaded();
  const all = await everything();

  api.fail("GET", LIST);
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "More notifications could not be loaded.",
  );
  expect(rows()).toHaveLength(10);

  api.restore();
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(rows()).toHaveLength(all.length));
});

test("with nothing to show, the empty state says nothing needs you and what will appear here", async () => {
  await updateAccountPreferences({
    notifications: {
      suspect_to_review: false,
      proposal_signed: false,
      invoice_draft_ready: false,
    },
  });
  renderScreen(<NotificationsScreen />);

  expect(await screen.findByText("Nothing needs you right now")).toBeDefined();
  expect(
    screen.getByText(
      "Suspects to review, signed proposals and invoice drafts for your leads appear here.",
    ),
  ).toBeDefined();
  expect(screen.queryByRole("list")).toBeNull();
});

test("when everything is read, no row is marked unread and the line says All read", async () => {
  for (const item of await everything()) await markNotificationRead(item.id);
  renderScreen(<NotificationsScreen />);
  await loaded();

  expect(await screen.findByText("All read")).toBeDefined();
  expect(screen.queryByText("Unread")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Mark read/ })).toBeNull();
});

test("while the list loads, rows of skeleton stand in for it", async () => {
  const release = api.hold("GET", LIST);
  renderScreen(<NotificationsScreen />);
  expect(
    screen.getByRole("status", { name: "Loading notifications" }),
  ).toBeDefined();
  expect(screen.queryByRole("list")).toBeNull();

  release();
  await loaded();
  expect(screen.queryByRole("status", { name: "Loading notifications" })).toBe(
    null,
  );
});

test("if the list cannot be loaded, the error state offers Try again, which loads it", async () => {
  api.fail("GET", LIST);
  renderScreen(<NotificationsScreen />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Your notifications could not be loaded");

  api.restore();
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  await loaded();
  expect(rows()).toHaveLength(10);
});

test("returning to the window brings in what was raised meanwhile, at the top, with the count", async () => {
  renderScreen(<NotificationsScreen />);
  await loaded();
  const { count } = await getUnreadCount();
  await screen.findByText(`${count} unread`);

  const lead = (await listVisibleLeads()).find(
    (candidate) => candidate.stage === "proposal_sent" && !candidate.exit,
  );
  vi.setSystemTime(new Date("2026-10-07T12:05:00.000Z"));
  await recordProposalStatus(lead?.id ?? "", "signed");
  await createNotification({ leadId: lead?.id ?? "", type: "proposal_signed" });
  expect(screen.queryByText(`${lead?.name} signed the proposal.`)).toBeNull();

  // What the browser reports when the person comes back to the tab.
  window.dispatchEvent(new Event("visibilitychange"));

  await waitFor(() =>
    expect(rows()[0].textContent).toContain(
      `${lead?.name} signed the proposal.`,
    ),
  );
  expect(await screen.findByText(`${count + 1} unread`)).toBeDefined();
});

test("viewed as Staff, the list holds only the notifications for that rep's own leads", async () => {
  const forOwner = await everything();
  viewAs("staff");
  const forStaff = await everything();
  expect(forStaff.length).toBeGreaterThan(0);
  expect(forStaff.length).toBeLessThan(forOwner.length);

  renderScreen(<NotificationsScreen />);
  await loaded();
  expect(rows().map((row) => row.getAttribute("href"))).toEqual(
    forStaff.map((item) => `/dashboard/leads/${item.lead.id}`),
  );
  const unread = forStaff.filter((item) => !item.read).length;
  expect(
    await screen.findByText(unread ? `${unread} unread` : "All read"),
  ).toBeDefined();
});
