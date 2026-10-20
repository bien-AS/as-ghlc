import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  api,
  FORBIDDEN,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";
import { research, resetLeadStore, updateLead } from "@/test/lead-store";

import { LeadScreen } from "./lead-screen";

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
vi.mock("@/lib/data/leads", async (original) => ({
  ...(await original<typeof import("@/lib/data/leads")>()),
  ...(await import("@/test/lead-store")).leadsModule,
}));
vi.mock(
  "@/lib/data/research",
  async () => (await import("@/test/lead-store")).researchModule,
);
vi.mock(
  "@/lib/data/status-defs",
  async () => (await import("@/test/lead-store")).statusDefsModule,
);

beforeEach(() => {
  startDashboard("/leads/lead-imogen");
  resetLeadStore();
});
afterEach(() => {
  cleanup();
  stopDashboard();
  vi.unstubAllEnvs();
});

async function open(leadId = "lead-imogen") {
  renderScreen(<LeadScreen leadId={leadId} />);
  await screen.findByRole("heading", { level: 1 });
}
/** Waits until the viewer's role has arrived and the admin actions are drawn. */
const asAdmin = () => screen.findByRole("button", { name: "Change status" });
const posts = () => api.calls().filter((call) => call.startsWith("POST"));
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const tab = (name: string) => screen.getByRole("tab", { name });
const seam = () => screen.getByRole("list", { name: "Writes to the CRM" });

async function confirm(trigger: string, confirmLabel: string) {
  fireEvent.click(button(trigger));
  const dialog = await screen.findByRole("alertdialog");
  const text = dialog.textContent ?? "";
  fireEvent.click(within(dialog).getByRole("button", { name: confirmLabel }));
  return text;
}

test("the header, the six tabs, the next step and the seam", async () => {
  await open();
  expect(
    screen.getByRole("heading", { level: 1, name: "Imogen Vasquez" }),
  ).toBeDefined();
  expect(screen.getByText("Vasquez Co")).toBeDefined();
  const chips = within(
    screen.getByRole("list", { name: "Where this lead stands" }),
  );
  for (const chip of [
    "Verdict: Valid",
    "Stage: Discovery Call Booked",
    "Lead Status: Appointment - Completed",
    "Rep: Maya Okafor",
  ]) {
    expect(chips.getByText(chip)).toBeDefined();
  }
  expect(screen.getAllByRole("tab").map((item) => item.textContent)).toEqual([
    "Overview",
    "Research",
    "Decks",
    "Proposals",
    "Meetings",
    "Timeline",
  ]);
  expect(
    screen.getByText("The call is done. Record whether this lead is a fit."),
  ).toBeDefined();
  expect(within(seam()).getByText("Validation verdict")).toBeDefined();
  expect(within(seam()).getByText("Written")).toBeDefined();
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("a website stored without a scheme links to the site, and one that is not http(s) is not a link", async () => {
  updateLead("lead-imogen", { website: "vasquezdental.com" });
  await open();
  expect(
    screen
      .getByRole("link", { name: /^vasquezdental\.com/ })
      .getAttribute("href"),
  ).toBe("https://vasquezdental.com/");
  cleanup();

  updateLead("lead-imogen", { website: "javascript:alert(1)" });
  await open();
  expect(screen.getByText("javascript:alert(1)")).toBeDefined();
  expect(screen.queryByRole("link", { name: /javascript/ })).toBeNull();
});

test("Qualified names its CRM write before confirming, calls the write once, and says it was skipped with writes off (check 3)", async () => {
  await open();
  const text = await confirm("Qualified", "Mark qualified");
  expect(text).toContain(
    "In the CRM: sets Qualification Decision to Qualified on the opportunity, and moves it to the Qualified stage.",
  );
  expect(text).toContain("The CRM then sends the follow-up email.");

  await screen.findByText("Marked Imogen Vasquez qualified");
  expect(
    screen.getByText(
      "Qualification decision was skipped. Writes to the CRM are off, so nothing was sent.",
    ),
  ).toBeDefined();
  expect(posts()).toEqual(["POST /api/leads/lead-imogen/qualification"]);

  // The seam shows the write; the header shows the new stage.
  expect(within(seam()).getByText("Qualification decision")).toBeDefined();
  expect(within(seam()).getByText("Skipped")).toBeDefined();
  expect(screen.getByText("Stage: Qualified")).toBeDefined();
});

test("Not qualified names Lead Lost; Cancel writes nothing", async () => {
  await open();
  fireEvent.click(button("Not qualified"));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.textContent).toContain(
    "sets Qualification Decision to Not qualified on the opportunity, and moves it to the Lead Lost stage.",
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(posts()).toEqual([]);
});

test("Mark as spam names Validation Status Spam and the CRM's removal, then writes once (check 3)", async () => {
  await open();
  const text = await confirm("Mark as spam", "Mark as spam");
  expect(text).toContain(
    "In the CRM: sets Validation Status to Spam on the contact.",
  );
  expect(text).toContain(
    "The CRM then cancels any booking, sends its note and removes the record.",
  );
  await screen.findByText("Marked Imogen Vasquez as spam");
  expect(posts()).toEqual(["POST /api/leads/lead-imogen/spam"]);
  expect(within(seam()).getByText("Marked as spam")).toBeDefined();
  // Gone from the pipeline: no action is left to press.
  expect(screen.queryByRole("button", { name: "Mark as spam" })).toBeNull();
});

test("Change status is an admin's, says it is app only and may be overwritten, and writes once", async () => {
  await open();
  await asAdmin();
  fireEvent.click(button("Change status"));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.textContent).toContain(
    "Nothing in the CRM. The status changes in this app only, and the CRM's own workflows may set it again at the next sync.",
  );
  fireEvent.change(within(dialog).getByLabelText("Lead Status"), {
    target: { value: "Engaging - Hot Lead" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Change status" }),
  );

  await screen.findByText("Lead Status is now Engaging - Hot Lead");
  expect(posts()).toEqual(["POST /api/leads/lead-imogen/status"]);
  expect(screen.getByText("Lead Status: Engaging - Hot Lead")).toBeDefined();
});

test("Assign rep is an admin's, app only, and writes once", async () => {
  await open();
  await asAdmin();
  fireEvent.click(button("Assign rep"));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.textContent).toContain("Nothing in the CRM.");
  await within(dialog).findByRole("option", { name: "Jonah Pike" });
  fireEvent.change(within(dialog).getByLabelText("Rep"), {
    target: { value: "00000000-0000-4000-8000-0000000000b2" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Assign" }));

  await screen.findByText("Assigned Imogen Vasquez to Jonah Pike");
  expect(posts()).toEqual(["POST /api/leads/lead-imogen/assign"]);
  expect(screen.getByText("Rep: Jonah Pike")).toBeDefined();
});

test("a rep sees their own lead with no admin actions, and another rep's lead does not exist (check 1)", async () => {
  viewAs("rep");
  await open();
  await screen.findByRole("button", { name: "Qualified" });
  expect(screen.queryByRole("button", { name: "Change status" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Assign rep" })).toBeNull();
  expect(document.querySelector('a[href="/admin/sync-log"]')).toBeNull();

  cleanup();
  renderScreen(<LeadScreen leadId="lead-sofia" />);
  await screen.findByText("This lead does not exist");
});

test("the research tab shows the brief, its claims with their sources, and the cost before a refresh", async () => {
  await open();
  fireEvent.click(tab("Research"));
  await screen.findByRole("heading", { name: "What they sell" });
  expect(screen.getByText("Family dentistry in two clinics.")).toBeDefined();
  expect(screen.getByText("Reviews mention short waits")).toBeDefined();
  const source = screen.getByRole("link", {
    name: /vasquez\.example\/locations/,
  });
  expect(source.getAttribute("href")).toBe("https://vasquez.example/locations");
  expect(
    screen.getByText("The model's inference, no source page"),
  ).toBeDefined();

  const text = await confirm("Refresh research", "Refresh research");
  expect(text).toContain("≈ $0.06 per run");
  expect(text).toContain("Nothing in the CRM.");
  await screen.findByText(
    "Researching this lead. The brief updates here when it is ready.",
  );
  expect(posts()).toEqual(["POST /api/leads/lead-imogen/research"]);
  // The previous brief stays while the new one is made.
  expect(screen.getByText("Family dentistry in two clinics.")).toBeDefined();
});

test("a failed research run says so, keeps the previous brief and offers to try again (check 4)", async () => {
  const current = research.get("lead-imogen");
  if (!current) throw new Error("no brief for Imogen");
  research.set("lead-imogen", {
    ...current,
    run: {
      status: "failed",
      error: "the website did not answer",
      createdAt: "2026-10-07T11:00:00.000Z",
    },
  });
  await open();
  fireEvent.click(tab("Research"));

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "The latest research run failed: the website did not answer. The brief below is the last one that finished.",
  );
  expect(screen.getByText("Family dentistry in two clinics.")).toBeDefined();

  const text = await confirm("Try again", "Refresh research");
  expect(text).toContain("≈ $0.06 per run");
  await screen.findByText(
    "Researching this lead. The brief updates here when it is ready.",
  );
  expect(posts()).toEqual(["POST /api/leads/lead-imogen/research"]);
});

test("a lead with no research yet says so", async () => {
  await open("lead-sofia");
  fireEvent.click(tab("Research"));
  await screen.findByText("No research yet");
  expect(
    screen.getByText("Research runs automatically after intake."),
  ).toBeDefined();

  // The first run says so, and that its cost has not been measured yet.
  const text = await confirm("Research now", "Research now");
  expect(text).toContain("Research this lead?");
  expect(text).toContain("Not measured");
  await screen.findByText(
    "Researching this lead. The brief updates here when it is ready.",
  );
  expect(posts()).toEqual(["POST /api/leads/lead-sofia/research"]);
});

test("nothing links to a screen that is not live: unshipped tabs show their empty state and no button (check 5)", async () => {
  // In production the deck, proposal and review-queue mockups are not live.
  vi.stubEnv("NODE_ENV", "production");
  await open("lead-desmond");
  expect(screen.getByText("Qualified. Build the proposal next.")).toBeDefined();

  for (const [name, empty] of [
    ["Decks", "No decks yet"],
    ["Proposals", "No proposals yet"],
    ["Meetings", "No meetings yet"],
  ]) {
    fireEvent.click(tab(name));
    await screen.findByText(empty);
  }
  const hrefs = [...document.querySelectorAll("a")].map((link) =>
    link.getAttribute("href"),
  );
  for (const href of hrefs) {
    expect(href, String(href)).toMatch(
      /^(\/leads(\/|$|\?)|\/admin\/sync-log$|mailto:|tel:|https:)/,
    );
  }
  expect(screen.queryByRole("link", { name: "Start proposal" })).toBeNull();
});

test("a refused action says the lead changed; a failed one says nothing was sent", async () => {
  api.fail("POST", /\/qualification$/, 409, { once: true });
  await open();
  await confirm("Qualified", "Mark qualified");
  await screen.findByText("That no longer applies");

  api.fail("POST", /\/spam$/, 500, { once: true });
  await confirm("Mark as spam", "Mark as spam");
  await screen.findByText("That did not go through");
  expect(
    screen.getByText("The lead is unchanged and nothing was sent. Try again."),
  ).toBeDefined();
});

test("loading shows a skeleton; a failed load shows the error state with Try again", async () => {
  api.fail("GET", /^\/api\/leads\/lead-imogen$/, 500, { once: true });
  renderScreen(<LeadScreen leadId="lead-imogen" />);
  expect(screen.getByLabelText("Loading lead")).toBeDefined();
  await screen.findByText("This lead could not be loaded");
  fireEvent.click(button("Try again"));
  await screen.findByRole("heading", { level: 1, name: "Imogen Vasquez" });
});
