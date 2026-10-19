import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { AuthoritySolutionsLogo } from "@/components/ui/authority-solutions-logo";
import { getPipelineSummary } from "@/lib/data/leads";
import {
  getUnreadCount,
  listNotifications,
  markNotificationRead,
} from "@/lib/data/notifications";
import { leadOptions } from "@/lib/queries/leads";
import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";
import { address, resetNavigation } from "@/test/navigation";
import { auth, navigate, resetClientFakes } from "@/test/render";
import { DashboardShell } from "./_components/dashboard-shell";
import { NotificationsScreen } from "./_components/notifications-screen";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
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
  startDashboard("/dashboard");
  resetClientFakes();
  // biome-ignore lint/suspicious/noDocumentCookie: clearing the sidebar's cookie between tests
  document.cookie = "sidebar_state=; path=/; max-age=0";
});
afterEach(() => {
  cleanup();
  stopDashboard();
});

/** jsdom reports no width; below 720px the sidebar is a sheet. */
function narrowScreen() {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  Object.defineProperty(window, "innerWidth", {
    value: 600,
    configurable: true,
  });
}
afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: 1024,
    configurable: true,
  });
});

function open(at = "/dashboard", sidebarOpen: boolean | "unset" = true) {
  resetNavigation(at);
  return renderScreen(
    <DashboardShell
      sidebarOpen={sidebarOpen === "unset" ? undefined : sidebarOpen}
      timeZone="UTC"
      sampleData
    >
      <h1 tabIndex={-1}>Screen</h1>
    </DashboardShell>,
  );
}
const mainNav = () => screen.getByRole("navigation", { name: "Main" });
const navLinks = () => within(mainNav()).getAllByRole("link");
const toggle = () => screen.getByRole("button", { name: "Navigation" });

test("the sidebar lists every live screen in order: a rep's work, a divider, then the Admin group", async () => {
  open();
  await screen.findByRole("link", { name: /Review Queue, 6 waiting/ });
  await screen.findByRole("link", { name: "Integrations" });

  expect(navLinks().map((link) => link.getAttribute("href"))).toEqual([
    "/dashboard",
    "/leads",
    "/review-queue",
    "/notifications",
    "/admin/reps",
    "/admin/integrations",
  ]);
  // Every screen is built: nothing is marked Soon.
  expect(mainNav().textContent).not.toContain("Soon");
  expect(mainNav().textContent).not.toContain("not built yet");
  // Personal settings are not in the sidebar; they are in the user menu.
  expect(mainNav().textContent).not.toContain("Account");

  const separator = mainNav().querySelector('[data-slot="sidebar-separator"]');
  expect(separator).not.toBeNull();
  expect(
    navLinks()[3].compareDocumentPosition(separator as Element) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    navLinks()[4].compareDocumentPosition(separator as Element) &
      Node.DOCUMENT_POSITION_PRECEDING,
  ).toBeTruthy();
  expect(within(mainNav()).getByText("Admin")).toBeDefined();

  // The wordmark leads home, and the shell never uses the internal name.
  expect(
    screen
      .getByRole("link", { name: "Go to the Dashboard" })
      .getAttribute("href"),
  ).toBe("/dashboard");
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test.each([
  ["/dashboard", "Dashboard"],
  ["/leads", "Leads"],
  ["/leads/lead-09", "Leads"],
  ["/review-queue", "Review Queue"],
  ["/review-queue?lead=lead-03", "Review Queue"],
  ["/admin/reps", "Reps"],
  ["/admin/integrations", "Integrations"],
])(
  "at %s the current screen is %s, and only it is marked current",
  async (at, label) => {
    open(at);
    await within(mainNav()).findByRole("link", { name: /Review Queue, / });
    const current = navLinks().filter(
      (link) => link.getAttribute("aria-current") === "page",
    );
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain(label);
  },
);

test("the suspect count matches the queue, and is left out rather than shown as zero when it is unavailable", async () => {
  api.fail("GET", /^\/api\/pipeline\/summary$/);
  open();
  await screen.findByText("Ada Lovelace");
  const suspects = navLinks()[2];
  expect(suspects.textContent).toBe("Review Queue");

  cleanup();
  api.restore();
  open();
  const { needs } = await getPipelineSummary({ tz: "UTC" });
  await screen.findByRole("link", {
    name: `Review Queue, ${needs.suspects} waiting`,
  });
});

test("the unread count is on the Notifications item and on the bell, and is left out rather than shown as zero when it is unavailable", async () => {
  api.fail("GET", /^\/api\/notifications\/unread-count$/);
  open();
  await screen.findByText("Ada Lovelace");
  await screen.findByRole("link", { name: /Review Queue, / });
  const bell = () =>
    within(screen.getByRole("banner")).getByRole("link", {
      name: /^Notifications/,
    });
  expect(navLinks()[3].textContent).toBe("Notifications");
  expect(bell().getAttribute("aria-label")).toBe("Notifications");
  expect(bell().textContent).toBe("");

  cleanup();
  api.restore();
  open();
  const { count } = await getUnreadCount();
  expect(count).toBeGreaterThan(0);
  const item = await within(mainNav()).findByRole("link", {
    name: `Notifications, ${count} unread`,
  });
  expect(item.getAttribute("href")).toBe("/notifications");
  expect(bell().getAttribute("aria-label")).toBe(
    `Notifications, ${count} unread`,
  );
  expect(bell().textContent).toBe(String(count));
});

test("with everything read, neither the Notifications item nor the bell shows a count", async () => {
  for (const item of (await listNotifications({ limit: 100 })).items) {
    await markNotificationRead(item.id);
  }
  open();
  await screen.findByRole("link", { name: /Review Queue, / });
  expect(api.calls()).toContain("GET /api/notifications/unread-count");
  await waitFor(() => expect(navLinks()[3].textContent).toBe("Notifications"));
  expect(
    within(screen.getByRole("banner")).getByRole("link", {
      name: "Notifications",
    }).textContent,
  ).toBe("");
});

test("marking a notification read lowers the count in the navigation by one, without leaving the screen", async () => {
  resetNavigation("/notifications");
  renderScreen(
    <DashboardShell sidebarOpen timeZone="UTC" sampleData>
      <NotificationsScreen />
    </DashboardShell>,
  );
  const { count } = await getUnreadCount();
  await within(mainNav()).findByRole("link", {
    name: `Notifications, ${count} unread`,
  });

  const [markRead] = await screen.findAllByRole("button", {
    name: /^Mark read/,
  });
  fireEvent.click(markRead);

  await within(mainNav()).findByRole("link", {
    name: `Notifications, ${count - 1} unread`,
  });
  // The screen's own heading is a <header> too, so the bar is found by its slot.
  expect(
    within(
      document.querySelector('[data-slot="top-navbar"]') as HTMLElement,
    ).getByRole("link", { name: `Notifications, ${count - 1} unread` }),
  ).toBeDefined();
  expect(address()).toBe("/notifications");
});

test("as Staff, the unread count is for that rep's own leads", async () => {
  const everyone = (await getUnreadCount()).count;
  viewAs("staff");
  const { count } = await getUnreadCount();
  expect(count).toBeLessThan(everyone);
  open();
  await within(mainNav()).findByRole("link", {
    name: count ? `Notifications, ${count} unread` : "Notifications",
  });
});

test("the collapse control says whether the navigation is expanded, and the choice is remembered", async () => {
  open();
  expect(toggle().getAttribute("aria-expanded")).toBe("true");

  fireEvent.click(toggle());
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(document.cookie).toContain("sidebar_state=false");
  expect(
    document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state"),
  ).toBe("collapsed");

  fireEvent.click(toggle());
  expect(toggle().getAttribute("aria-expanded")).toBe("true");
  expect(document.cookie).toContain("sidebar_state=true");

  // The remembered choice is what the next load starts from.
  cleanup();
  open("/dashboard", false);
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
});

test("with no remembered choice the sidebar starts expanded on a wide screen and as icons on a medium one", async () => {
  Object.defineProperty(window, "innerWidth", {
    value: 1280,
    configurable: true,
  });
  open("/dashboard", "unset");
  expect(toggle().getAttribute("aria-expanded")).toBe("true");

  cleanup();
  Object.defineProperty(window, "innerWidth", {
    value: 900,
    configurable: true,
  });
  open("/dashboard", "unset");
  await waitFor(() =>
    expect(toggle().getAttribute("aria-expanded")).toBe("false"),
  );
  // A default is not a choice: nothing is remembered until the person presses the control.
  expect(document.cookie).not.toContain("sidebar_state");
});

test("on a small screen the sidebar is hidden until the menu button opens it as a sheet; choosing an item or Escape closes it", async () => {
  narrowScreen();
  open();
  await screen.findByRole("button", { name: /Account/ });
  expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  expect(toggle().getAttribute("aria-expanded")).toBe("false");

  fireEvent.click(toggle());
  const sheet = await screen.findByRole("dialog", { name: "Navigation" });
  expect(within(sheet).getAllByRole("link").length).toBeGreaterThanOrEqual(6);

  fireEvent.click(within(sheet).getByRole("link", { name: /Review Queue/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.click(toggle());
  await screen.findByRole("dialog", { name: "Navigation" });
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("the navbar shows where you are; inside a lead it is Leads, then the lead's name, with Leads a link", async () => {
  open("/admin/reps");
  const crumbs = () => screen.getByRole("navigation", { name: "breadcrumb" });
  expect(crumbs().textContent).toBe("Reps");

  // A screen with no sidebar entry still has its title.
  cleanup();
  open("/settings/profile");
  expect(crumbs().textContent).toBe("Account settings");
  expect(
    navLinks().filter((link) => link.getAttribute("aria-current") === "page"),
  ).toEqual([]);

  cleanup();
  resetNavigation("/leads/lead-09");
  sessionStorage.setItem("dealwright:pipeline-search", "tab=new");
  const view = renderScreen(
    <DashboardShell sidebarOpen timeZone="UTC" sampleData>
      <h1>Screen</h1>
    </DashboardShell>,
  );
  expect(crumbs().textContent).toBe("LeadsLead");
  // The name comes from the lead the page has already loaded; the navbar asks for nothing.
  view.queryClient.setQueryData(leadOptions("lead-09").queryKey, {
    name: "Sofia Lindgren",
  } as never);
  await waitFor(() => expect(crumbs().textContent).toBe("LeadsSofia Lindgren"));
  expect(
    within(crumbs()).getByRole("link", { name: "Leads" }).getAttribute("href"),
  ).toBe("/leads?tab=new");
  expect(api.calls().filter((call) => call.includes("/api/leads/"))).toEqual(
    [],
  );

  // One suspect in the queue: the queue, then the lead.
  cleanup();
  open("/review-queue?lead=lead-03");
  expect(crumbs().textContent).toBe("Review QueueLead");
  expect(
    within(crumbs())
      .getByRole("link", { name: "Review Queue" })
      .getAttribute("href"),
  ).toBe("/review-queue");

  cleanup();
  open("/nowhere");
  expect(crumbs().textContent).toBe("Page not found");
});

test("typing in the navbar search and pressing Enter opens Leads with that search", async () => {
  open("/admin/reps");
  const search = screen.getByRole("search");
  // A search term is not sensitive, and is meant to be in the address: this form is GET, to Leads.
  expect(search.getAttribute("method")).toBe("get");
  expect(search.getAttribute("action")).toBe("/leads");

  fireEvent.change(
    within(search).getByRole("searchbox", { name: "Search leads" }),
    {
      target: { value: " Bellweather & Sons " },
    },
  );
  fireEvent.submit(search);
  expect(address()).toBe("/leads?q=Bellweather%20%26%20Sons");
});

test("the navbar carries the notifications entry and the Sample data label with its explanation, and no role preview", async () => {
  open();
  const bell = within(screen.getByRole("banner")).getByRole("link", {
    name: /^Notifications/,
  });
  expect(bell.getAttribute("href")).toBe("/notifications");

  const label = screen.getByRole("button", { name: "Sample data" });
  fireEvent.focus(label);
  expect(
    await screen.findByText(
      "The leads shown are examples. Changes are not kept: they reset when the server restarts.",
    ),
  ).toBeDefined();
  // The theme is chosen in the user menu; the navbar has no switch of its own.
  expect(screen.queryByRole("group", { name: "Theme" })).toBeNull();
  // The role preview is deleted (spec 01).
  expect(screen.queryByRole("button", { name: /Viewing as/ })).toBeNull();
});

test("the user menu shows the signed-in user's name and email, Settings, the theme, and Sign out ends the session", async () => {
  open();
  const trigger = await screen.findByRole("button", {
    name: "Account: Ada Lovelace",
  });
  fireEvent.click(trigger);
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByText("Ada Lovelace")).toBeDefined();
  expect(within(menu).getByText("ada@example.com")).toBeDefined();
  // Settings here are the person's own.
  expect(
    within(menu)
      .getByRole("menuitem", { name: "Settings" })
      .getAttribute("href"),
  ).toBe("/settings/profile");
  expect(
    within(menu)
      .getAllByRole("menuitemradio")
      .map((item) => item.textContent),
  ).toEqual(["System", "Light", "Dark"]);

  fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Dark" }));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("as-vantage-theme")).toBe("dark");
  localStorage.clear();
  document.documentElement.className = "";

  fireEvent.click(within(menu).getByRole("menuitem", { name: "Sign out" }));
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login"));
});

test("on a small screen the Sample data note moves into the user menu", async () => {
  narrowScreen();
  open();
  fireEvent.click(await screen.findByRole("button", { name: /Account/ }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByText(/The leads shown are examples/)).toBeDefined();
});

// --- roles (spec 12, question 7: proposed roles) --------------------------------

test("as Staff, the Admin group is left out of the sidebar", async () => {
  viewAs("staff");
  open();
  await screen.findByText("Maya Okafor");
  await waitFor(() =>
    expect(navLinks().map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard",
      "/leads",
      "/review-queue",
      "/notifications",
    ]),
  );
  expect(mainNav().textContent).not.toContain("Admin");
  expect(mainNav().querySelector('[data-slot="sidebar-separator"]')).toBeNull();
});

test("as Admin, the sidebar is the same as the Owner's", async () => {
  viewAs("admin");
  open();
  await within(mainNav()).findByRole("link", { name: "Integrations" });
  expect(navLinks()).toHaveLength(6);
});

// --- phase flags (spec 01, section 3) ----------------------------------------------

test("in production no link to a mockup is rendered: the sidebar is the Dashboard alone, with no search, bell or Settings", async () => {
  vi.stubEnv("NODE_ENV", "production");
  try {
    open("/leads/lead-09");
    await screen.findByText("Ada Lovelace");
    expect(navLinks().map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard",
    ]);
    expect(screen.queryByRole("search")).toBeNull();
    expect(
      within(screen.getByRole("banner")).queryByRole("link", {
        name: /^Notifications/,
      }),
    ).toBeNull();
    // The crumb names Leads, but does not link to it.
    const crumbs = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(crumbs.textContent).toBe("LeadsLead");
    expect(crumbs.querySelector("a[href]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Account/ }));
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).queryByRole("menuitem", { name: "Settings" }),
    ).toBeNull();
  } finally {
    vi.unstubAllEnvs();
  }
});

test("Skip to content is the first thing focus reaches and points at the main area, which holds the screen", () => {
  open();
  const [first] = Array.from(
    document.querySelectorAll<HTMLElement>("a[href], button, input"),
  );
  expect(first.textContent).toBe("Skip to content");
  expect(first.getAttribute("href")).toBe("#main-content");
  const main = screen.getByRole("main");
  expect(main.id).toBe("main-content");
  expect(within(main).getByRole("heading", { name: "Screen" })).toBeDefined();
});

test("after moving to another screen, focus goes to its heading", async () => {
  const { router } = await import("@/test/navigation");
  open("/dashboard");
  const heading = screen.getByRole("heading", { name: "Screen" });
  expect(document.activeElement).not.toBe(heading);

  router.push("/admin/reps");
  await waitFor(() => expect(document.activeElement).toBe(heading));
});

// --- the endorsement logo --------------------------------------------------------

test("the logo shows the dark artwork on light and the white artwork on dark, chosen by the theme class with no box around it", () => {
  const { container } = render(<AuthoritySolutionsLogo height={32} />);
  const images = Array.from(container.querySelectorAll("img"));
  const file = (image: HTMLImageElement) =>
    decodeURIComponent(image.getAttribute("src") ?? "");

  expect(images).toHaveLength(2);
  const [onLight, onDark] = images;
  expect(file(onLight)).toContain("/as-logo.png");
  expect(onLight.className).toContain("dark:hidden");
  expect(file(onDark)).toContain("/as-logo-white.png");
  expect(onDark.className).toContain("hidden");
  expect(onDark.className).toContain("dark:block");
  for (const image of images) {
    expect(image.getAttribute("alt")).toBe("Authority Solutions");
    // Height only; the width follows from the 680 by 173 artwork.
    expect(image.getAttribute("height")).toBe("32");
    expect(image.getAttribute("width")).toBe("126");
  }
  // No plate: no padding, background or corner of its own.
  const wrapper = container.querySelector(
    '[data-slot="authority-solutions-logo"]',
  );
  expect(wrapper?.getAttribute("style")).toBeNull();
  expect(wrapper?.className).not.toMatch(/\bbg-|\bp-\d|rounded|\blight\b/);
});

test("a section can force the variant: the white file on a dark section in the light theme, and the reverse", () => {
  const dark = render(<AuthoritySolutionsLogo surface="dark" />);
  const [onDark, ...rest] = Array.from(dark.container.querySelectorAll("img"));
  expect(rest).toHaveLength(0);
  expect(decodeURIComponent(onDark.getAttribute("src") ?? "")).toContain(
    "/as-logo-white.png",
  );
  expect(onDark.className).not.toContain("hidden");
  dark.unmount();

  const light = render(<AuthoritySolutionsLogo surface="light" />);
  const images = Array.from(light.container.querySelectorAll("img"));
  expect(images).toHaveLength(1);
  expect(decodeURIComponent(images[0].getAttribute("src") ?? "")).toContain(
    "/as-logo.png",
  );
  expect(images[0].className).not.toContain("hidden");
});
