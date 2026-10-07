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
import { leadOptions } from "@/lib/queries/leads";
import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
} from "@/test/dashboard";
import { address, resetNavigation } from "@/test/navigation";
import { auth, navigate, resetClientFakes } from "@/test/render";
import { fake } from "@/test/server-fakes";
import { DashboardShell } from "./_components/dashboard-shell";
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

test("the sidebar lists all seven screens in order, built ones first, each resolving to its route", async () => {
  open();
  await screen.findByRole("link", { name: /Suspect review, 6 waiting/ });

  expect(navLinks().map((link) => link.getAttribute("href"))).toEqual([
    "/dashboard",
    "/dashboard/suspects",
    "/dashboard/notifications",
    "/dashboard/deck-presenter",
    "/dashboard/proposal-builder",
    "/dashboard/users",
    "/dashboard/settings",
  ]);
  // The five unbuilt screens come after a divider, each marked Soon and said
  // to be not built yet; they are still links.
  const names = navLinks().map((link) => link.textContent);
  expect(names.slice(0, 2).some((name) => name?.includes("Soon"))).toBe(false);
  for (const name of names.slice(2)) {
    expect(name).toContain("Soon");
    expect(name).toContain("not built yet");
  }
  const separator = mainNav().querySelector('[data-slot="sidebar-separator"]');
  expect(separator).not.toBeNull();
  expect(
    navLinks()[1].compareDocumentPosition(separator as Element) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    navLinks()[2].compareDocumentPosition(separator as Element) &
      Node.DOCUMENT_POSITION_PRECEDING,
  ).toBeTruthy();

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
  ["/dashboard/settings", "Settings and integrations"],
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
  // Notifications shows no count in this build.
  expect(navLinks()[2].textContent).not.toMatch(/\d/);
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
  expect(within(sheet).getAllByRole("link").length).toBeGreaterThanOrEqual(7);

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
  expect(crumbs().textContent).toBe("Settings and integrations");

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

test("the navbar carries the notifications entry, the Sample data label with its explanation, and the theme switch", async () => {
  open();
  const bell = screen.getByRole("link", { name: "Notifications" });
  expect(bell.getAttribute("href")).toBe("/dashboard/notifications");
  expect(bell.textContent).toBe("");

  const label = screen.getByRole("button", { name: "Sample data" });
  fireEvent.focus(label);
  expect(
    await screen.findByText(
      "The leads shown are examples. Changes are not kept: they reset when the server restarts.",
    ),
  ).toBeDefined();
  expect(screen.getByRole("group", { name: "Theme" })).toBeDefined();
});

test("the user menu shows the signed-in user's name and email, and Sign out ends the session", async () => {
  open();
  const trigger = await screen.findByRole("button", {
    name: "Account: Ada Lovelace",
  });
  fireEvent.click(trigger);
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByText("Ada Lovelace")).toBeDefined();
  expect(within(menu).getByText("ada@example.com")).toBeDefined();
  // On a wide screen the theme switch is in the navbar, not repeated here.
  expect(within(menu).queryByRole("menuitemradio")).toBeNull();

  fireEvent.click(within(menu).getByRole("menuitem", { name: "Sign out" }));
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
});

test("on a small screen the theme and the Sample data note move into the user menu", async () => {
  narrowScreen();
  open();
  // The navbar's own switch is not displayed below the `nav` breakpoint.
  expect(screen.getByRole("group", { name: "Theme" }).className).toMatch(
    /(^| )hidden( |$)/,
  );

  fireEvent.click(await screen.findByRole("button", { name: /Account/ }));
  const menu = await screen.findByRole("menu");
  expect(
    within(menu)
      .getAllByRole("menuitemradio")
      .map((item) => item.textContent),
  ).toEqual(["System", "Light", "Dark"]);
  expect(within(menu).getByText(/The leads shown are examples/)).toBeDefined();

  fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Dark" }));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("theme")).toBe("dark");
  localStorage.clear();
  document.documentElement.className = "";
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

test.each(
  NAV_ITEMS.filter((item) => !item.built).map(
    (item) => [item.label, item] as const,
  ),
)(
  "the %s placeholder names the screen, says Not built yet, what it will do and what it waits on, and offers no control",
  async (label, item) => {
    if (item.built) throw new Error("unreachable");
    await placeholder(item.href.split("/").slice(2));

    expect(
      screen.getByRole("heading", { level: 1, name: label }),
    ).toBeDefined();
    expect(screen.getByText("Not built yet")).toBeDefined();
    expect(screen.getByText(item.willDo)).toBeDefined();
    expect(screen.getByRole("heading", { name: "Waiting on" })).toBeDefined();
    expect(
      screen.getAllByRole("listitem").map((entry) => entry.textContent),
    ).toEqual(item.waitingOn);
    expect(item.waitingOn.length).toBeGreaterThan(0);
    // Nothing that looks like a working control, and no brand names.
    expect(
      document.querySelectorAll("button, a, input, select, textarea"),
    ).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(FORBIDDEN);
  },
);

test("there are exactly five placeholders, and each sidebar entry is a built screen or one of them", () => {
  expect(
    NAV_ITEMS.filter((item) => !item.built).map((item) => item.label),
  ).toEqual([
    "Notifications",
    "Deck presenter",
    "Proposal builder",
    "Users and roles",
    "Settings and integrations",
  ]);
  expect(
    NAV_ITEMS.filter((item) => item.built).map((item) => item.href),
  ).toEqual(["/dashboard", "/dashboard/suspects"]);
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

test("a placeholder page applies the who-is-sent-where table itself: signed out and profile-less visitors are redirected", async () => {
  fake.users.clear();
  await expect(placeholder(["settings"])).rejects.toThrow(
    "redirect:/profile-setup",
  );
  fake.claims = null;
  await expect(placeholder(["settings"])).rejects.toThrow(
    "redirect:/sign-in?next=%2Fdashboard%2Fsettings",
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
