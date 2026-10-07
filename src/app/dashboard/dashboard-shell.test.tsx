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
import { fake } from "@/test/server-fakes";
import { DashboardShell } from "./_components/dashboard-shell";
import { NotificationsScreen } from "./_components/notifications-screen";
import PlaceholderPage from "./[...rest]/page";
import { NAV_ITEMS } from "./navigation";
import DashboardNotFound from "./not-found";

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

test("the sidebar lists every screen in order: a rep's work, a divider, then the Workspace's own screens", async () => {
  open();
  await screen.findByRole("link", { name: /Suspect review, 6 waiting/ });
  await screen.findByRole("link", { name: "Integrations" });

  expect(navLinks().map((link) => link.getAttribute("href"))).toEqual([
    "/dashboard",
    "/dashboard/suspects",
    "/dashboard/notifications",
    "/dashboard/deck-presenter",
    "/dashboard/proposal-builder",
    "/dashboard/users",
    "/dashboard/settings",
    "/dashboard/integrations",
  ]);
  // Every screen is built: nothing is marked Soon.
  expect(mainNav().textContent).not.toContain("Soon");
  expect(mainNav().textContent).not.toContain("not built yet");
  // Personal settings are not in the sidebar; they are in the user menu.
  expect(mainNav().textContent).not.toContain("Account");

  const separator = mainNav().querySelector('[data-slot="sidebar-separator"]');
  expect(separator).not.toBeNull();
  expect(
    navLinks()[4].compareDocumentPosition(separator as Element) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    navLinks()[5].compareDocumentPosition(separator as Element) &
      Node.DOCUMENT_POSITION_PRECEDING,
  ).toBeTruthy();
  expect(within(mainNav()).getByText("Workspace")).toBeDefined();

  // The wordmark leads home, and the shell never uses the internal name.
  expect(
    screen
      .getByRole("link", { name: "Dealwright, go to the Pipeline" })
      .getAttribute("href"),
  ).toBe("/dashboard");
  expect(document.body.textContent).toContain("Dealwright");
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test.each([
  ["/dashboard", "Pipeline"],
  ["/dashboard/leads/lead-09", "Pipeline"],
  ["/dashboard/suspects", "Suspect review"],
  ["/dashboard/suspects/lead-03", "Suspect review"],
  ["/dashboard/settings", "Workspace settings"],
  ["/dashboard/integrations", "Integrations"],
])(
  "at %s the current screen is %s, and only it is marked current",
  async (at, label) => {
    open(at);
    await within(mainNav()).findByRole("link", { name: /Suspect review, / });
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
  const suspects = navLinks()[1];
  expect(suspects.textContent).toBe("Suspect review");

  cleanup();
  api.restore();
  open();
  const { needs } = await getPipelineSummary({ tz: "UTC" });
  await screen.findByRole("link", {
    name: `Suspect review, ${needs.suspects} waiting`,
  });
});

test("the unread count is on the Notifications item and on the bell, and is left out rather than shown as zero when it is unavailable", async () => {
  api.fail("GET", /^\/api\/notifications\/unread-count$/);
  open();
  await screen.findByText("Ada Lovelace");
  await screen.findByRole("link", { name: /Suspect review, / });
  const bell = () =>
    within(screen.getByRole("banner")).getByRole("link", {
      name: /^Notifications/,
    });
  expect(navLinks()[2].textContent).toBe("Notifications");
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
  expect(item.getAttribute("href")).toBe("/dashboard/notifications");
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
  await screen.findByRole("link", { name: /Suspect review, / });
  expect(api.calls()).toContain("GET /api/notifications/unread-count");
  await waitFor(() => expect(navLinks()[2].textContent).toBe("Notifications"));
  expect(
    within(screen.getByRole("banner")).getByRole("link", {
      name: "Notifications",
    }).textContent,
  ).toBe("");
});

test("marking a notification read lowers the count in the navigation by one, without leaving the screen", async () => {
  resetNavigation("/dashboard/notifications");
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
  expect(address()).toBe("/dashboard/notifications");
});

test("viewed as Staff, the unread count is for that rep's own leads", async () => {
  const everyone = (await getUnreadCount()).count;
  viewAs("staff");
  const { count } = await getUnreadCount();
  expect(count).toBeLessThan(everyone);
  open();
  await screen.findByRole("button", { name: "Viewing as Staff (preview)" });
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
  expect(within(sheet).getAllByRole("link").length).toBeGreaterThanOrEqual(8);

  fireEvent.click(within(sheet).getByRole("link", { name: /Suspect review/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.click(toggle());
  await screen.findByRole("dialog", { name: "Navigation" });
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("the navbar shows where you are; inside a lead it is Pipeline, then the lead's name, with Pipeline a link", async () => {
  open("/dashboard/settings");
  const crumbs = () => screen.getByRole("navigation", { name: "breadcrumb" });
  expect(crumbs().textContent).toBe("Workspace settings");

  // A screen with no sidebar entry still has its title.
  cleanup();
  open("/dashboard/account");
  expect(crumbs().textContent).toBe("Account settings");
  expect(
    navLinks().filter((link) => link.getAttribute("aria-current") === "page"),
  ).toEqual([]);

  cleanup();
  resetNavigation("/dashboard/leads/lead-09");
  sessionStorage.setItem("dealwright:pipeline-search", "tab=new");
  const view = renderScreen(
    <DashboardShell sidebarOpen timeZone="UTC" sampleData>
      <h1>Screen</h1>
    </DashboardShell>,
  );
  expect(crumbs().textContent).toBe("PipelineLead");
  // The name comes from the lead the page has already loaded; the navbar asks for nothing.
  view.queryClient.setQueryData(leadOptions("lead-09").queryKey, {
    name: "Sofia Lindgren",
  } as never);
  await waitFor(() =>
    expect(crumbs().textContent).toBe("PipelineSofia Lindgren"),
  );
  expect(
    within(crumbs())
      .getByRole("link", { name: "Pipeline" })
      .getAttribute("href"),
  ).toBe("/dashboard?tab=new");
  expect(api.calls().filter((call) => call.includes("/api/leads/"))).toEqual(
    [],
  );

  cleanup();
  open("/dashboard/nowhere");
  expect(crumbs().textContent).toBe("Page not found");
});

test("typing in the navbar search and pressing Enter opens the Pipeline with that search", async () => {
  open("/dashboard/settings");
  const search = screen.getByRole("search");
  // A search term is not sensitive, and is meant to be in the address: this form is GET, to the Pipeline.
  expect(search.getAttribute("method")).toBe("get");
  expect(search.getAttribute("action")).toBe("/dashboard");

  fireEvent.change(
    within(search).getByRole("searchbox", { name: "Search leads" }),
    {
      target: { value: " Bellweather & Sons " },
    },
  );
  fireEvent.submit(search);
  expect(address()).toBe("/dashboard?q=Bellweather%20%26%20Sons");
});

test("the navbar carries the notifications entry, the Sample data label with its explanation, and the role preview", async () => {
  open();
  const bell = within(screen.getByRole("banner")).getByRole("link", {
    name: /^Notifications/,
  });
  expect(bell.getAttribute("href")).toBe("/dashboard/notifications");

  const label = screen.getByRole("button", { name: "Sample data" });
  fireEvent.focus(label);
  expect(
    await screen.findByText(
      "The leads shown are examples. Changes are not kept: they reset when the server restarts.",
    ),
  ).toBeDefined();
  // The theme is chosen in the user menu; the navbar has no switch of its own.
  expect(screen.queryByRole("group", { name: "Theme" })).toBeNull();
  expect(
    await screen.findByRole("button", { name: "Viewing as Owner (preview)" }),
  ).toBeDefined();
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
  // Settings here are the person's own; the Workspace's are in the sidebar.
  expect(
    within(menu)
      .getByRole("menuitem", { name: "Settings" })
      .getAttribute("href"),
  ).toBe("/dashboard/account");
  expect(
    within(menu)
      .getAllByRole("menuitemradio")
      .map((item) => item.textContent),
  ).toEqual(["System", "Light", "Dark"]);

  fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Dark" }));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("theme")).toBe("dark");
  localStorage.clear();
  document.documentElement.className = "";

  fireEvent.click(within(menu).getByRole("menuitem", { name: "Sign out" }));
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
});

test("on a small screen the role preview and the Sample data note move into the user menu", async () => {
  narrowScreen();
  open();
  fireEvent.click(await screen.findByRole("button", { name: /Account/ }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByText(/The leads shown are examples/)).toBeDefined();
  expect(within(menu).getByText("Viewing as (preview)")).toBeDefined();
  expect(
    within(menu)
      .getAllByRole("menuitemradio")
      .map((item) => item.textContent),
  ).toEqual(expect.arrayContaining([expect.stringMatching(/^Staff/)]));
});

// --- the role preview (spec 12, question 7: proposed roles) -------------------

test("the role preview says it is a preview, lists the three roles with what each sees, and marks the current one", async () => {
  open();
  fireEvent.click(
    await screen.findByRole("button", { name: "Viewing as Owner (preview)" }),
  );
  const menu = await screen.findByRole("menu");
  const roles = within(menu).getAllByRole("menuitemradio");
  expect(roles.map((role) => role.textContent)).toEqual([
    "OwnerEverything in the Workspace",
    "AdminEvery lead, plus users and connections",
    "StaffOnly the leads assigned to them",
  ]);
  expect(roles.map((role) => role.getAttribute("aria-checked"))).toEqual([
    "true",
    "false",
    "false",
  ]);
  expect(within(menu).getByText(/not who has access/)).toBeDefined();
});

test("choosing another role saves it on the server and loads the page again, so the server decides what that role sees", async () => {
  open("/dashboard/users");
  fireEvent.click(
    await screen.findByRole("button", { name: "Viewing as Owner (preview)" }),
  );
  fireEvent.click(
    within(await screen.findByRole("menu")).getByRole("menuitemradio", {
      name: /Staff/,
    }),
  );

  // A full load of the page the person is on (jsdom's own address is "/").
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  expect(api.calls()).toContain("POST /api/viewer/role");
  expect(fake.cookies.get("dw_preview_role")).toBe("staff");
});

test("viewed as Staff, the Workspace's screens leave the sidebar and the preview says whose leads are shown", async () => {
  viewAs("staff");
  open();
  const control = await screen.findByRole("button", {
    name: "Viewing as Staff (preview)",
  });
  expect(navLinks().map((link) => link.getAttribute("href"))).toEqual([
    "/dashboard",
    "/dashboard/suspects",
    "/dashboard/notifications",
    "/dashboard/deck-presenter",
    "/dashboard/proposal-builder",
  ]);
  expect(mainNav().textContent).not.toContain("Workspace");
  expect(mainNav().querySelector('[data-slot="sidebar-separator"]')).toBeNull();

  fireEvent.click(control);
  expect(
    within(await screen.findByRole("menu")).getByText(
      /Staff is shown Maya Okafor's leads\./,
    ),
  ).toBeDefined();
});

test("viewed as Admin, the sidebar is the same as the Owner's", async () => {
  viewAs("admin");
  open();
  await screen.findByRole("button", { name: "Viewing as Admin (preview)" });
  expect(navLinks()).toHaveLength(8);
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

  router.push("/dashboard/settings");
  await waitFor(() => expect(document.activeElement).toBe(heading));
});

// --- placeholders and "page not found" -----------------------------------------

const placeholder = async (rest: string[]) =>
  render(
    await PlaceholderPage({
      params: Promise.resolve({ rest }),
      searchParams: Promise.resolve({}),
    }),
  );

test("no placeholder remains: every sidebar entry is a built screen", () => {
  expect(NAV_ITEMS.filter((item) => !item.built)).toEqual([]);
});

test("an unknown dashboard address is page not found, with a link to the Pipeline", async () => {
  await expect(placeholder(["nowhere"])).rejects.toThrow("notFound");
  await expect(placeholder(["notifications", "extra"])).rejects.toThrow(
    "notFound",
  );
  // A built screen's own route is not a placeholder either.
  await expect(placeholder(["suspects"])).rejects.toThrow("notFound");

  render(<DashboardNotFound />);
  expect(screen.getByText("Page not found")).toBeDefined();
  expect(
    screen
      .getByRole("link", { name: "Go to the Pipeline" })
      .getAttribute("href"),
  ).toBe("/dashboard");
});

test("the catch-all page applies the who-is-sent-where table itself: signed out and profile-less visitors are redirected", async () => {
  fake.users.clear();
  await expect(placeholder(["nowhere"])).rejects.toThrow(
    "redirect:/profile-setup",
  );
  fake.claims = null;
  await expect(placeholder(["nowhere"])).rejects.toThrow(
    "redirect:/sign-in?next=%2Fdashboard%2Fnowhere",
  );
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
