import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getLead, reviewSuspect } from "@/lib/data/leads";
import type { LeadDetail } from "@/lib/leads/schemas";
import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
} from "@/test/dashboard";
import { resetStandIns, standIns } from "@/test/mockup-stand-ins";
import { address, resetNavigation } from "@/test/navigation";

import { SuspectScreen } from "./suspect-screen";

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
vi.mock(
  "@/lib/navigate",
  async () => (await import("@/test/render")).navigateModule,
);
// Leads live in Postgres: the queue reads the six suspect stand-ins instead,
// through the real Route Handlers. The decision's writes are proven on the
// database (leads.db.test.ts).
vi.mock("@/lib/data/leads", async (original) => ({
  ...(await original<typeof import("@/lib/data/leads")>()),
  ...(await import("@/test/mockup-stand-ins")).mockupLeadsModule,
}));

beforeEach(() => {
  startDashboard("/review-queue");
  resetStandIns();
});
afterEach(() => {
  cleanup();
  stopDashboard();
});

/** The stand-ins, all suspects, created at the same moment: by name. */
const NAMES = [1, 2, 3, 4, 5, 6].map((n) => `Stand-in ${n}`);
const idOf = (name: string) => `stand-in-${name.split(" ")[1]}`;

/** A call five hours from now, as the queue and the panel show it. */
const CALL = {
  kind: "discovery" as const,
  time: "2026-10-07T17:00:00.000Z",
  state: "confirmed" as const,
};
/** Stand-in 1 as a suspect with everything a lead can say. */
const TALKATIVE: Partial<LeadDetail> = {
  email: "rex@thornburyglobalholdings.example",
  website: "https://thornburyglobalholdings.example",
  budget: "$250,000 a month",
  formAnswers: [
    { question: "Monthly budget", answer: "$250,000 a month" },
    {
      question: "Anything else?",
      answer: "Need results fast, will pay upfront.",
    },
  ],
  verdictRecord: {
    result: "suspect",
    summary:
      "The company cannot be found and the budget does not fit the request.",
    reasons: ["No company record", "Budget far above the request", "Urgency"],
    reviewOutcome: null,
    reviewedBy: null,
    reviewedAt: null,
  },
  nextBooking: CALL,
  bookings: [CALL],
};

/** The page: it hands the screen the lead id from the address, as the route does. */
function Page() {
  return <SuspectScreen leadId={useSearchParams().get("lead") ?? undefined} />;
}

async function open(at = "/review-queue") {
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

test("lists exactly the unreviewed suspects, oldest first, with a count, and opens the oldest", async () => {
  standIns.patch.set(idOf("Stand-in 1"), { nextBooking: CALL });
  await open();
  await selected("Stand-in 1");

  expect(queueNames()).toEqual(NAMES);
  expect(screen.getAllByText("(6)").length).toBeGreaterThan(0);
  expect(current()).toBe("Stand-in 1");

  // How long each has waited, and the call of those that have one.
  const first = within(
    screen.getByRole("navigation", { name: "Suspects waiting" }),
  ).getAllByRole("link")[0];
  expect(first.textContent).toContain("Waiting 6 days");
  expect(first.textContent).toContain("Call Wed, Oct 7, 5:00 PM");
  expect(within(first).getByText("Call within a day")).toBeDefined();

  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("shows what the lead said beside why the AI is unsure, and the booking line", async () => {
  standIns.patch.set(idOf("Stand-in 1"), TALKATIVE);
  await open();
  await selected("Stand-in 1");

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
  ).toBe("/leads/stand-in-1");
});

test("a suspect without a call, answers or reasons says so, and can still be decided", async () => {
  await open(`/review-queue?lead=${idOf("Stand-in 2")}`);
  await selected("Stand-in 2");

  expect(screen.getByText("No call booked.")).toBeDefined();
  expect(screen.getByText("No form answers on this lead.")).toBeDefined();
  expect(screen.getByText("The AI gave no reasons.")).toBeDefined();
  expect(current()).toBe("Stand-in 2");
  expect(button("Clear as valid").disabled).toBe(false);
  expect(button("Mark as spam").disabled).toBe(false);

  // A summary with no reasons shows the summary alone.
  cleanup();
  standIns.patch.set(idOf("Stand-in 3"), {
    verdictRecord: {
      ...(TALKATIVE.verdictRecord as NonNullable<LeadDetail["verdictRecord"]>),
      summary: "The message reads like a sales pitch rather than an enquiry.",
      reasons: [],
    },
  });
  await open(`/review-queue?lead=${idOf("Stand-in 3")}`);
  await selected("Stand-in 3");
  expect(
    screen.getByText(
      "The message reads like a sales pitch rather than an enquiry.",
    ),
  ).toBeDefined();
  expect(screen.queryByText("The AI gave no reasons.")).toBeNull();
});

test("Clear as valid needs no confirmation: the lead leaves the queue, the next is selected and takes focus, the counts drop", async () => {
  await open();
  await selected("Stand-in 1");

  fireEvent.click(button("Clear as valid"));
  expect(screen.queryByRole("alertdialog")).toBeNull();

  const heading = await selected("Stand-in 2");
  expect(address()).toBe("/review-queue?lead=stand-in-2");
  await waitFor(() => expect(queueNames()).not.toContain("Stand-in 1"));
  expect(queueNames()).toHaveLength(5);
  expect(screen.getAllByText("(5)").length).toBeGreaterThan(0);
  await waitFor(() => expect(document.activeElement).toBe(heading));
  await screen.findByText("Cleared as valid: Stand-in 1");

  expect((await getLead("stand-in-1")).verdict).toBe("valid");
});

test("Mark as spam asks first, naming the lead and the cancelled call; Cancel changes nothing; confirming moves on", async () => {
  standIns.patch.set(idOf("Stand-in 1"), { nextBooking: CALL });
  await open();
  await selected("Stand-in 1");

  fireEvent.click(button("Mark as spam"));
  const dialog = within(
    screen.getByRole("alertdialog", { name: "Mark Stand-in 1 as spam?" }),
  );
  expect(dialog.getByText(/its booked call will be cancelled/)).toBeDefined();
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect((await getLead("stand-in-1")).exit).toBeNull();
  expect(queueNames()).toHaveLength(6);

  fireEvent.click(button("Mark as spam"));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Mark as spam",
    }),
  );
  await screen.findByText("Marked as spam: Stand-in 1");
  await waitFor(() => expect(queueNames()).toHaveLength(5));
  expect((await getLead("stand-in-1")).exit).toBe("spam");
});

test("both decisions are disabled while one is in progress, and pressing twice records one decision", async () => {
  await open();
  await selected("Stand-in 1");
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
  await selected("Stand-in 1");
  api.fail("POST", /\/review$/);

  fireEvent.click(button("Clear as valid"));
  await screen.findByText(
    "That decision was not recorded. The lead is still waiting.",
  );
  expect(current()).toBe("Stand-in 1");
  expect(queueNames()).toHaveLength(6);
  expect(address()).toBe("/review-queue");
  expect((await getLead("stand-in-1")).verdict).toBe("suspect");

  api.restore();
  fireEvent.click(button("Try again"));
  await waitFor(() => expect(queueNames()).toHaveLength(5));
  expect((await getLead("stand-in-1")).verdict).toBe("valid");
});

test("a lead someone else has just decided is refused as a conflict: the screen says so and moves on", async () => {
  await open();
  await selected("Stand-in 1");
  // A colleague rejects it while this screen still shows it as waiting.
  await reviewSuspect("stand-in-1", { outcome: "spam" });

  fireEvent.click(button("Clear as valid"));
  await screen.findByText(
    "Someone has already decided that lead, so it has left the queue.",
  );
  await selected("Stand-in 2");
  await waitFor(() => expect(queueNames()).not.toContain("Stand-in 1"));
  // Their decision stands.
  expect((await getLead("stand-in-1")).exit).toBe("spam");
});

test("clearing the last suspect shows the empty state, confirming the queue is clear", async () => {
  for (const name of NAMES.slice(1)) {
    await reviewSuspect(idOf(name), { outcome: "cleared" });
  }
  await open();
  await selected("Stand-in 1");
  expect(queueNames()).toEqual(["Stand-in 1"]);

  fireEvent.click(button("Clear as valid"));
  await screen.findByText("Queue clear");
  expect(
    screen.getByText("Suspects land here when the classifier is unsure."),
  ).toBeDefined();
  expect(address()).toBe("/review-queue");
  expect(
    screen
      .getByRole("link", { name: "Go to the Pipeline" })
      .getAttribute("href"),
  ).toBe("/leads");
  expect(screen.queryByRole("button", { name: "Clear as valid" })).toBeNull();
});

test("an empty queue says where suspects come from, with no review panel", async () => {
  for (const name of NAMES) {
    await reviewSuspect(idOf(name), { outcome: "cleared" });
  }
  await open();
  await screen.findByText("Queue clear");
  expect(
    screen.getByText("Suspects land here when the classifier is unsure."),
  ).toBeDefined();
  expect(screen.queryByRole("region", { name: "Review" })).toBeNull();
});

test.each<[string, Partial<LeadDetail>]>([
  ["cleared as valid", { verdict: "valid" }],
  ["marked as spam", { exit: "spam" }],
  ["lost", { exit: "lost" }],
])(
  "a lead %s is not an unreviewed suspect: the screen says so, offers the lead and no decision",
  async (_, patch) => {
    standIns.patch.set("stand-in-4", patch);
    await open("/review-queue?lead=stand-in-4");

    await screen.findByText("Nothing to decide on this lead");
    expect(
      screen.getByText("It has already been decided, or it is not a suspect."),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Open Stand-in 4" })
        .getAttribute("href"),
    ).toBe("/leads/stand-in-4");
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
  await selected("Stand-in 1");
});

test("when one lead fails to load, the queue stays and the panel offers Try again", async () => {
  api.fail("GET", /^\/api\/leads\/stand-in-/);
  await open();

  await screen.findByText("This lead could not be loaded");
  expect(queueNames()).toHaveLength(6);
  api.restore();
  fireEvent.click(button("Try again"));
  await selected("Stand-in 1");
});
