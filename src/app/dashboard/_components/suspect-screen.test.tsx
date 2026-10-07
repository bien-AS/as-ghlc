import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  getLead,
  getPipelineSummary,
  listLeads,
  reviewSuspect,
} from "@/lib/data/leads";
import { listLeadsQuerySchema } from "@/lib/leads/schemas";
import {
  api,
  FORBIDDEN,
  leadIdOf,
  renderScreen,
  startDashboard,
  stopDashboard,
} from "@/test/dashboard";
import { address, resetNavigation } from "@/test/navigation";

import { SuspectScreen } from "./suspect-screen";

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

beforeEach(() => startDashboard("/dashboard/suspects"));
afterEach(() => {
  cleanup();
  stopDashboard();
});

/** The page: it hands the screen the lead id from the address, as the route does. */
function Page() {
  return <SuspectScreen leadId={usePathname().split("/")[3]} />;
}

async function open(at = "/dashboard/suspects") {
  resetNavigation(at);
  renderScreen(<Page />);
}
const queueNames = () =>
  within(screen.getByRole("navigation", { name: "Suspects waiting" }))
    .getAllByRole("link")
    .map(
      (link) => link.querySelector('[data-slot="list-row-name"]')?.textContent,
    );
const current = () =>
  within(screen.getByRole("navigation", { name: "Suspects waiting" }))
    .getAllByRole("link")
    .find((link) => link.getAttribute("aria-current") === "true")
    ?.querySelector('[data-slot="list-row-name"]')?.textContent;
const selected = (name: string) =>
  screen.findByRole("heading", { level: 2, name });
const button = (name: string | RegExp) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const waiting = async () =>
  (
    await listLeads(listLeadsQuerySchema.parse({ needs: "suspects" }))
  ).items.map((lead) => lead.name);

test("lists exactly the unreviewed suspects, oldest first, with a count, and opens the oldest", async () => {
  await open();
  await selected("Rex Thornbury");

  const names = await waiting();
  expect(queueNames()).toEqual(names);
  expect(names).toHaveLength(6);
  expect(screen.getAllByText("(6)").length).toBeGreaterThan(0);
  expect((await getPipelineSummary({ tz: "UTC" })).needs.suspects).toBe(6);
  expect(current()).toBe("Rex Thornbury");

  // How long each has waited, and the call of those that have one.
  const first = within(
    screen.getByRole("navigation", { name: "Suspects waiting" }),
  ).getAllByRole("link")[0];
  expect(first.textContent).toContain("Waiting 3 days");
  expect(first.textContent).toContain("Call Wed, Oct 7, 5:00 PM");
  expect(within(first).getByText("Call within a day")).toBeDefined();

  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("shows what the lead said beside why the AI is unsure, and the booking line", async () => {
  await open();
  await selected("Rex Thornbury");

  const said = screen.getByRole("heading", { name: "What the lead said" })
    .parentElement as HTMLElement;
  expect(
    within(said).getByText("rex@thornburyglobalholdings.example"),
  ).toBeDefined();
  const site = within(said).getByRole("link", {
    name: /^thornburyglobalholdings\.example/,
  });
  expect(site.getAttribute("target")).toBe("_blank");
  // The budget field and the answer to the budget question.
  expect(within(said).getAllByText("$250,000 a month")).toHaveLength(2);
  expect(
    within(said).getByText("Need results fast, will pay upfront."),
  ).toBeDefined();

  const why = screen.getByRole("heading", { name: "Why the AI is unsure" })
    .parentElement as HTMLElement;
  const box = why.querySelector('[data-slot="verdict-box"]');
  expect(box?.getAttribute("data-tone")).toBe("crit");
  expect(box?.textContent).toContain("Suspect");
  expect(box?.textContent).toContain(
    "The company cannot be found and the budget does not fit the request.",
  );
  expect(within(why).getAllByRole("listitem")).toHaveLength(3);

  expect(
    screen.getByText(/^Call booked for .*It stays booked until you decide\.$/),
  ).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Open full lead" }).getAttribute("href"),
  ).toBe(`/dashboard/leads/${await leadIdOf("Rex Thornbury")}`);
});

test("a suspect without a call, answers or reasons says so, and can still be decided", async () => {
  await open(`/dashboard/suspects/${await leadIdOf("Bao Trinh")}`);
  await selected("Bao Trinh");

  expect(screen.getByText("No call booked.")).toBeDefined();
  expect(screen.getByText("No form answers on this lead.")).toBeDefined();
  expect(screen.getByText("The AI gave no reasons.")).toBeDefined();
  expect(current()).toBe("Bao Trinh");
  expect(button("Clear as valid").disabled).toBe(false);
  expect(button("Mark as spam").disabled).toBe(false);

  // A summary with no reasons shows the summary alone.
  cleanup();
  await open(`/dashboard/suspects/${await leadIdOf("Mitra Dalgaard")}`);
  await selected("Mitra Dalgaard");
  expect(
    screen.getByText(
      "The message reads like a sales pitch rather than an enquiry.",
    ),
  ).toBeDefined();
  expect(screen.queryByText("The AI gave no reasons.")).toBeNull();
});

test("Clear as valid needs no confirmation: the lead leaves the queue, the next is selected and takes focus, the counts drop", async () => {
  await open();
  await selected("Rex Thornbury");
  const rex = await leadIdOf("Rex Thornbury");
  const [, next] = await waiting();

  fireEvent.click(button("Clear as valid"));
  expect(screen.queryByRole("alertdialog")).toBeNull();

  const heading = await selected(next);
  expect(address()).toBe(`/dashboard/suspects/${await leadIdOf(next)}`);
  await waitFor(() => expect(queueNames()).not.toContain("Rex Thornbury"));
  expect(queueNames()).toHaveLength(5);
  expect(screen.getAllByText("(5)").length).toBeGreaterThan(0);
  await waitFor(() => expect(document.activeElement).toBe(heading));
  await screen.findByText("Cleared as valid: Rex Thornbury");

  // The lead itself: valid, reviewed by the signed-in user, booking untouched.
  const lead = await getLead(rex);
  expect(lead.verdict).toBe("valid");
  expect(lead.verdictRecord?.reviewedBy).toBe("Ada Lovelace");
  expect(lead.nextBooking?.state).toBe("confirmed");
  expect(lead.activities[0].detail).toBe("Cleared as valid.");
  expect((await getPipelineSummary({ tz: "UTC" })).needs.suspects).toBe(5);
});

test("Mark as spam asks first, naming the lead and the cancelled call; Cancel changes nothing; confirming moves on", async () => {
  await open();
  await selected("Rex Thornbury");
  const rex = await leadIdOf("Rex Thornbury");

  fireEvent.click(button("Mark as spam"));
  const dialog = within(
    screen.getByRole("alertdialog", { name: "Mark Rex Thornbury as spam?" }),
  );
  expect(dialog.getByText(/its booked call will be cancelled/)).toBeDefined();
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect((await getLead(rex)).exit).toBeNull();
  expect(queueNames()).toHaveLength(6);

  fireEvent.click(button("Mark as spam"));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Mark as spam",
    }),
  );
  await screen.findByText("Marked as spam: Rex Thornbury");
  await waitFor(() => expect(queueNames()).toHaveLength(5));

  const lead = await getLead(rex);
  expect(lead.exit).toBe("spam");
  expect(lead.bookings.map((booking) => booking.state)).toEqual(["cancelled"]);
  expect(lead.verdictRecord?.reviewedBy).toBe("Ada Lovelace");
});

test("both decisions are disabled while one is in progress, and pressing twice records one decision", async () => {
  await open();
  await selected("Rex Thornbury");
  const release = api.hold("POST", /\/review$/);

  fireEvent.click(button("Clear as valid"));
  await waitFor(() =>
    expect(
      button(/^(Loading\s*)?Clear as valid$/).getAttribute("aria-busy"),
    ).toBe("true"),
  );
  expect(button("Mark as spam").disabled).toBe(true);
  // The queue cannot be changed until it settles.
  for (const link of within(
    screen.getByRole("navigation", { name: "Suspects waiting" }),
  ).getAllByRole("link")) {
    expect(link.getAttribute("aria-disabled")).toBe("true");
  }
  fireEvent.click(button(/^(Loading\s*)?Clear as valid$/));

  release();
  await waitFor(() => expect(queueNames()).toHaveLength(5));
  expect(api.calls().filter((call) => call.startsWith("POST "))).toHaveLength(
    1,
  );
});

test("when a decision fails, the lead stays selected and unreviewed, and Try again records it", async () => {
  await open();
  await selected("Rex Thornbury");
  const rex = await leadIdOf("Rex Thornbury");
  api.fail("POST", /\/review$/);

  fireEvent.click(button("Clear as valid"));
  await screen.findByText(
    "That decision was not recorded. The lead is still waiting.",
  );
  expect(current()).toBe("Rex Thornbury");
  expect(queueNames()).toHaveLength(6);
  expect(address()).toBe("/dashboard/suspects");
  expect((await getLead(rex)).verdict).toBe("suspect");

  api.restore();
  fireEvent.click(button("Try again"));
  await waitFor(() => expect(queueNames()).toHaveLength(5));
  expect((await getLead(rex)).verdict).toBe("valid");
});

test("a lead someone else has just decided is refused as a conflict: the screen says so and moves on", async () => {
  await open();
  await selected("Rex Thornbury");
  const rex = await leadIdOf("Rex Thornbury");
  const [, next] = await waiting();
  // A colleague rejects it while this screen still shows it as waiting.
  await reviewSuspect(rex, { outcome: "spam" });

  fireEvent.click(button("Clear as valid"));
  await screen.findByText(
    "Someone has already decided that lead, so it has left the queue.",
  );
  await selected(next);
  await waitFor(() => expect(queueNames()).not.toContain("Rex Thornbury"));
  // Their decision stands.
  expect((await getLead(rex)).exit).toBe("spam");
});

test("clearing the last suspect shows the empty state, confirming the queue is clear", async () => {
  const names = await waiting();
  for (const name of names.slice(1)) {
    await reviewSuspect(await leadIdOf(name), { outcome: "cleared" });
  }
  await open();
  await selected(names[0]);
  expect(queueNames()).toEqual([names[0]]);

  fireEvent.click(button("Clear as valid"));
  await screen.findByText("No suspects to review");
  expect(
    screen.getByText(
      "The queue is clear. Leads the AI is unsure about appear here.",
    ),
  ).toBeDefined();
  expect(address()).toBe("/dashboard/suspects");
  expect(
    screen
      .getByRole("link", { name: "Go to the Pipeline" })
      .getAttribute("href"),
  ).toBe("/dashboard");
  expect(screen.queryByRole("button", { name: "Clear as valid" })).toBeNull();
});

test("an empty queue says where suspects come from, with no review panel", async () => {
  for (const name of await waiting()) {
    await reviewSuspect(await leadIdOf(name), { outcome: "cleared" });
  }
  await open();
  await screen.findByText("No suspects to review");
  expect(
    screen.getByText("Leads the AI is unsure about appear here."),
  ).toBeDefined();
  expect(screen.queryByRole("region", { name: "Review" })).toBeNull();
});

test.each([
  "Sofia Lindgren",
  "Odette Blackwood",
  "Wendell Krause",
  "Best SEO Deals",
])(
  "%s is not an unreviewed suspect: the screen says so, offers the lead and no decision",
  async (name) => {
    const leadId = await leadIdOf(name);
    await open(`/dashboard/suspects/${leadId}`);

    await screen.findByText("Nothing to decide on this lead");
    expect(
      screen.getByText("It has already been decided, or it is not a suspect."),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: `Open ${name}` }).getAttribute("href"),
    ).toBe(`/dashboard/leads/${leadId}`);
    expect(screen.queryByRole("button", { name: "Clear as valid" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark as spam" })).toBeNull();
  },
);

test("loading shows skeletons; a failed queue shows the error state with Try again", async () => {
  api.fail("GET", /^\/api\/leads$/);
  await open();
  expect(screen.getByRole("status", { name: "Loading suspect" })).toBeDefined();

  await screen.findByText("The suspect queue could not be loaded");
  api.restore();
  fireEvent.click(button("Try again"));
  await selected("Rex Thornbury");
});

test("when one lead fails to load, the queue stays and the panel offers Try again", async () => {
  api.fail("GET", /^\/api\/leads\/lead-/);
  await open();

  await screen.findByText("This lead could not be loaded");
  expect(queueNames()).toHaveLength(6);
  api.restore();
  fireEvent.click(button("Try again"));
  await selected("Rex Thornbury");
});
