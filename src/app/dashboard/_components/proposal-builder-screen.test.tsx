import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getInvoice } from "@/lib/data/invoices";
import { getLead, markLost } from "@/lib/data/leads";
import {
  getProposal,
  listProposalLeads,
  sendProposal,
} from "@/lib/data/proposals";
import {
  api,
  FORBIDDEN,
  leadIdOf,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";
import { resetNavigation } from "@/test/navigation";

import { LeadScreen } from "./lead-screen";
import { ProposalBuilderScreen } from "./proposal-builder-screen";

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

const BUILDER = "/dashboard/proposal-builder";

beforeEach(() => startDashboard(BUILDER));
afterEach(() => {
  cleanup();
  stopDashboard();
});

/** Opens the builder on the sample lead with this name, and waits for it. */
async function open(name: string) {
  const leadId = await leadIdOf(name);
  resetNavigation(`${BUILDER}?lead=${leadId}`);
  renderScreen(<ProposalBuilderScreen />);
  await screen.findByRole("heading", {
    level: 1,
    name: `Proposal for ${name}`,
  });
  return leadId;
}
const button = (name: string | RegExp) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const noButton = (name: string | RegExp) =>
  expect(screen.queryByRole("button", { name })).toBeNull();
const field = (label: string | RegExp) =>
  screen.getByLabelText<HTMLInputElement>(label);
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const chips = () =>
  within(screen.getByRole("list", { name: "Where this proposal stands" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
const panel = (title: string) =>
  within(
    screen
      .getByRole("heading", { name: title })
      .closest("section") as HTMLElement,
  );
const hint = () =>
  document.querySelector('[data-slot="hint-line"]')?.textContent ?? "";
/** The services in the preview, as "name price". */
const previewed = () =>
  within(panel("Preview").getByRole("table"))
    .getAllByRole("row")
    .map((row) =>
      Array.from(row.children)
        .map((cell) => cell.textContent)
        .join(" | "),
    );
/** Waits until the viewer's role has arrived, which decides whether simulating is offered. */
async function viewerKnown() {
  await waitFor(() => expect(api.calls()).toContain("GET /api/viewer"));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
const writes = () =>
  api.calls().filter((call) => /^(POST|PUT) \/api\/proposals/.test(call));

// --- the picker -----------------------------------------------------------------

test("with no lead in the address, the picker lists each lead with its stage and proposal status, linking into the builder", async () => {
  renderScreen(<ProposalBuilderScreen />);
  await screen.findByRole("heading", { level: 1, name: "Proposal builder" });

  const rows = within(
    await screen.findByRole("region", { name: "Leads" }),
  ).getAllByRole("link");
  expect(rows).toHaveLength((await listProposalLeads()).length);

  const kwame = rows.find((row) => row.textContent?.includes("Kwame Asante"));
  expect(kwame?.textContent).toBe(
    "Kwame AsanteAsante SolarQualifiedProposal: Draft",
  );
  expect(kwame?.getAttribute("href")).toBe(
    `${BUILDER}?lead=${await leadIdOf("Kwame Asante")}`,
  );
  const text = rows.map((row) => row.textContent);
  expect(text).toContain(
    "Beatrix OlanderOlander ChiropracticQualifiedProposal: Not started",
  );
  expect(text).toContain(
    "Jonas WhitlockWhitlock ElectricalLead WonProposal: Signed",
  );
  expect(text.some((row) => row?.includes("Sofia Lindgren"))).toBe(false);
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("staff see only their own leads in the picker", async () => {
  viewAs("staff");
  renderScreen(<ProposalBuilderScreen />);
  const rows = within(
    await screen.findByRole("region", { name: "Leads" }),
  ).getAllByRole("link");
  expect(rows.map((row) => row.textContent?.split("Qualified")[0])).toContain(
    "Liesel HartmannHartmann Kitchens",
  );
  expect(rows.some((row) => row.textContent?.includes("Kwame Asante"))).toBe(
    false,
  );
});

test("the picker shows a skeleton while loading, an error with Try again, and an empty state when no lead is ready", async () => {
  api.fail("GET", /^\/api\/proposals$/);
  renderScreen(<ProposalBuilderScreen />);
  expect(screen.getByRole("status", { name: "Loading leads" })).toBeDefined();
  await screen.findByText("The leads could not be loaded");
  expect(screen.getByRole("alert")).toBeDefined();

  api.restore();
  fireEvent.click(button("Try again"));
  await screen.findByRole("region", { name: "Leads" });

  // Every lead that could have a proposal leaves the pipeline.
  cleanup();
  for (const lead of await listProposalLeads()) await markLost(lead.id, {});
  renderScreen(<ProposalBuilderScreen />);
  await screen.findByText("No lead is ready for a proposal");
  expect(
    screen
      .getByRole("link", { name: "Go to the Pipeline" })
      .getAttribute("href"),
  ).toBe("/dashboard");
});

// --- not started ----------------------------------------------------------------

test("a qualified lead with no proposal shows its details and one main action, Generate proposal, which starts a draft", async () => {
  const leadId = await open("Beatrix Olander");
  expect(chips()).toEqual(["Proposal: Not started", "Stage: Qualified"]);
  expect(panel("Client").getByText("Olander Chiropractic")).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Beatrix Olander" }).getAttribute("href"),
  ).toBe(`/dashboard/leads/${leadId}`);
  expect(hint()).toContain("Sample data:");
  expect(button("Generate proposal").className).toContain("bg-primary");
  expect(screen.queryByRole("textbox")).toBeNull();

  fireEvent.click(button("Generate proposal"));
  await screen.findByLabelText("Name");
  expect(chips()[0]).toBe("Proposal: Draft");
  expect(field("Name").value).toBe("Beatrix Olander");
  expect(field("Company").value).toBe("Olander Chiropractic");
  expect(field("Email").value).toMatch(/^beatrix@.+\.example$/);
  expect(field("Service, line 1").value).toBe("Local SEO");
  expect(field("Price (USD), line 1").value).toBe("1500");
  expect(panel("Services").getByText("$7,900")).toBeDefined();
  await screen.findByText("Draft ready");

  expect((await getProposal(leadId)).proposal?.status).toBe("draft");
  expect((await getLead(leadId)).proposal).toEqual({ status: "draft" });
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("a lead that cannot have a proposal yet says why and links back to the lead", async () => {
  const early = await open("Sofia Lindgren");
  expect(
    screen.getByText("This lead cannot have a proposal yet"),
  ).toBeDefined();
  expect(
    screen.getByText(/A proposal can be started once the lead is Qualified\./),
  ).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Back to the lead" }).getAttribute("href"),
  ).toBe(`/dashboard/leads/${early}`);
  noButton("Generate proposal");

  cleanup();
  await open("Cordelia Vance");
  expect(
    screen.getByText(/This lead left the pipeline: Lead Lost\./),
  ).toBeDefined();
  noButton("Generate proposal");
});

// --- the draft ------------------------------------------------------------------

test("a draft is edited in place: client details, services from the catalogue or custom, prices, a running total and a live preview", async () => {
  const leadId = await open("Kwame Asante");
  expect(field("Name").value).toBe("Kwame Asante");
  expect(field("Email").value).toBe("kwame@asantesolar.example");
  expect(previewed()).toEqual([
    "Service | Price",
    "Paid search managementSearch ad campaigns set up and managed. Ad spend is separate. | $1,200",
    "Analytics and reportingCall and form tracking with a monthly report. | $400",
    "Total | $1,600",
  ]);
  expect(panel("Preview").getByText("Proposal for Asante Solar")).toBeDefined();
  // Saved, and sendable: the hint says what is next.
  expect(hint()).toBe("Saved. Review it, then send it to the lead.");
  expect(button("Save draft").disabled).toBe(true);
  expect(button("Review and send").disabled).toBe(false);

  // A price changes the total and the preview at once.
  type("Price (USD), line 1", "1,350.50");
  expect(panel("Services").getByText("$1,750.50")).toBeDefined();
  expect(previewed().at(-1)).toBe("Total | $1,750.50");
  // Unsaved changes cannot be sent.
  expect(button("Review and send").disabled).toBe(true);
  expect(hint()).toMatch(/^You have changes that are not saved\./);

  // From the catalogue, with its suggested price.
  fireEvent.change(field("From the catalogue"), {
    target: { value: "reputation" },
  });
  fireEvent.click(button("Add service"));
  expect(field("Service, line 3").value).toBe("Reputation management");
  expect(field("Price (USD), line 3").value).toBe("800");
  await waitFor(() =>
    expect(document.activeElement).toBe(field("Service, line 3")),
  );

  // A custom one.
  fireEvent.click(button("Add a custom service"));
  type("Service, line 4", "Photography day");
  type("Price (USD), line 4", "900");
  type("Description, line 4", "One day on site.");

  // Remove the second line; the rest renumber.
  fireEvent.click(button("Remove Analytics and reporting"));
  expect(field("Service, line 2").value).toBe("Reputation management");
  expect(panel("Services").getByText("$3,050.50")).toBeDefined();

  type("Company", "  Asante Solar Ltd ");
  type("A note to the lead", "As we discussed.");
  expect(panel("Preview").getByText("As we discussed.")).toBeDefined();
  expect(
    panel("Preview").getByText("Proposal for Asante Solar Ltd"),
  ).toBeDefined();

  fireEvent.click(button("Save draft"));
  await screen.findByText("Draft saved");
  // What was stored is what the form now shows, trimmed.
  expect(field("Company").value).toBe("Asante Solar Ltd");
  expect(button("Save draft").disabled).toBe(true);
  expect(button("Review and send").disabled).toBe(false);

  const stored = (await getProposal(leadId)).proposal;
  expect(stored).toMatchObject({
    status: "draft",
    total: 3050.5,
    context: "As we discussed.",
    client: { company: "Asante Solar Ltd" },
    lineItems: [
      { service: "Paid search management", price: 1350.5 },
      { service: "Reputation management", price: 800 },
      {
        service: "Photography day",
        description: "One day on site.",
        price: 900,
      },
    ],
  });
  // Saving a draft does not move the lead.
  expect((await getLead(leadId)).stage).toBe("qualified");
  expect(document.body.textContent).not.toMatch(FORBIDDEN);
});

test("fields that are wrong say so beside themselves, nothing is saved, and correcting one withdraws its error", async () => {
  await open("Kwame Asante");
  type("Name", "  ");
  type("Email", "kwame-at-asante");
  type("Service, line 2", "");
  type("Price (USD), line 1", "about a thousand");

  fireEvent.click(button("Save draft"));
  expect(screen.getByText("Enter the client's name.")).toBeDefined();
  expect(screen.getByText("Enter a valid email address.")).toBeDefined();
  expect(screen.getByText("Name the service.")).toBeDefined();
  expect(screen.getByText("Enter a price in dollars.")).toBeDefined();
  for (const label of [
    "Name",
    "Email",
    "Service, line 2",
    "Price (USD), line 1",
  ]) {
    expect(field(label).getAttribute("aria-invalid")).toBe("true");
  }
  // Focus goes to the first one.
  expect(document.activeElement).toBe(field("Name"));
  expect(writes()).toEqual([]);

  type("Name", "Kwame Asante");
  expect(screen.queryByText("Enter the client's name.")).toBeNull();
  expect(field("Name").getAttribute("aria-invalid")).toBeNull();
  expect(screen.getByText("Enter a price in dollars.")).toBeDefined();

  // A line that is removed takes its error with it.
  fireEvent.click(button("Remove line 2"));
  expect(screen.queryByText("Name the service.")).toBeNull();
});

test("a draft with no priced service, or no email, cannot be sent, and the hint says what is missing", async () => {
  await open("Kwame Asante");
  fireEvent.click(button("Remove Paid search management"));
  fireEvent.click(button("Remove Analytics and reporting"));
  expect(
    panel("Services").getByText(/^No services yet\. Add one/),
  ).toBeDefined();
  expect(panel("Preview").getByText("No services yet.")).toBeDefined();
  fireEvent.click(button("Save draft"));
  await screen.findByText("Draft saved");
  expect(hint()).toBe("Add at least one service with a price before sending.");
  expect(button("Review and send").disabled).toBe(true);

  fireEvent.click(button("Add service"));
  type("Email", "");
  fireEvent.click(button("Save draft"));
  await waitFor(() =>
    expect(hint()).toBe("Add the client's email before sending."),
  );
  expect(button("Review and send").disabled).toBe(true);
});

// --- review, send, viewed, signed -----------------------------------------------------

test("review and send names the recipient, the line count and the total; then the lead views and signs, reaches Lead Won, and the invoice draft is on Lead detail", async () => {
  const leadId = await open("Kwame Asante");

  // Review: Cancel changes nothing.
  fireEvent.click(button("Review and send"));
  const review = within(
    screen.getByRole("alertdialog", {
      name: "Send this proposal to Kwame Asante?",
    }),
  );
  expect(review.getByText(/It goes to/).textContent?.replace(/\s+/g, " ")).toBe(
    "It goes to kwame@asantesolar.example with 2 services, $1,600 in total. Once sent it cannot be edited, and the lead moves to Proposal Sent. Sample data: nothing is sent.",
  );
  fireEvent.click(review.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(writes()).toEqual([]);
  expect((await getProposal(leadId)).proposal?.status).toBe("draft");

  // Confirm: sent, and read-only from here on.
  fireEvent.click(button("Review and send"));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Send proposal",
    }),
  );
  await waitFor(() =>
    expect(chips()).toEqual(["Proposal: Sent", "Stage: Proposal Sent"]),
  );
  await screen.findByText("Proposal sent: Kwame Asante");
  expect(screen.queryByRole("textbox")).toBeNull();
  noButton("Save draft");
  noButton("Review and send");
  expect(
    panel("Status").getByText(/Waiting for the lead to view and sign it\./),
  ).toBeDefined();
  expect(panel("Status").getByText(/^Sent to/).textContent).toContain(
    "kwame@asantesolar.example",
  );
  expect(previewed().at(-1)).toBe("Total | $1,600");
  expect((await getLead(leadId)).stage).toBe("proposal_sent");

  // What stands in for the proposal service reporting back.
  const simulate = panel("Simulate what the lead does");
  expect(
    simulate.getByText(
      "Sample data: this stands in for the proposal service reporting back.",
    ),
  ).toBeDefined();
  fireEvent.click(simulate.getByRole("button", { name: "Lead viewed it" }));
  await waitFor(() => expect(chips()[0]).toBe("Proposal: Viewed"));
  expect(
    panel("Status").getByText(/The lead has opened the proposal\./),
  ).toBeDefined();
  noButton("Lead viewed it");

  fireEvent.click(button("Lead signed it"));
  await waitFor(() =>
    expect(chips()).toEqual(["Proposal: Signed", "Stage: Lead Won"]),
  );
  expect(panel("Status").getByText(/is now Lead Won/).textContent).toContain(
    "Kwame Asante is now Lead Won",
  );
  expect(
    screen
      .getByRole("link", { name: "Open invoice draft" })
      .getAttribute("href"),
  ).toBe(`/dashboard/leads/${leadId}#invoice`);
  expect(screen.queryByRole("heading", { name: /^Simulate/ })).toBeNull();
  noButton("Lead signed it");
  expect(document.body.textContent).not.toMatch(FORBIDDEN);

  expect(await getLead(leadId)).toMatchObject({
    stage: "won",
    proposal: { status: "signed" },
    invoice: { status: "draft" },
  });
  const snapshot = (await getProposal(leadId)).proposal?.snapshot;
  expect((await getInvoice(leadId))?.lines).toEqual(
    snapshot?.map((item) => ({
      description: item.service,
      amount: item.price,
    })),
  );

  // Lead detail now shows the won lead and its invoice draft.
  cleanup();
  renderScreen(<LeadScreen leadId={leadId} />);
  await screen.findByRole("heading", { level: 1, name: "Kwame Asante" });
  expect(
    screen
      .getByRole("link", { name: "Check invoice draft" })
      .getAttribute("href"),
  ).toBe(`/dashboard/leads/${leadId}#invoice`);
  const invoice = panel("Invoice");
  await invoice.findByText("Draft");
  expect(
    within(invoice.getByRole("list", { name: "Invoice lines" }))
      .getAllByRole("listitem")
      .map((line) => line.textContent),
  ).toEqual(["Paid search management$1,200", "Analytics and reporting$400"]);
  expect(invoice.getByText("$1,600")).toBeDefined();
  expect(panel("Activity").getByText("Invoice drafted")).toBeDefined();
});

test("while a write is in progress its button shows it, the others cannot be pressed, and a second press does nothing", async () => {
  await open("Anneliese Brandt");
  const release = api.hold("POST", /\/simulate$/);

  fireEvent.click(
    await screen.findByRole("button", { name: "Lead signed it" }),
  );
  await waitFor(() =>
    expect(button(/Lead signed it$/).getAttribute("aria-busy")).toBe("true"),
  );
  expect(button("Lead viewed it").disabled).toBe(true);
  fireEvent.click(button(/Lead signed it$/));

  release();
  await waitFor(() => expect(chips()[0]).toBe("Proposal: Signed"));
  expect(writes()).toHaveLength(1);
});

test("a proposal that changed elsewhere refuses the save, says so, and shows the proposal as it now is", async () => {
  const leadId = await open("Kwame Asante");
  // Someone else sends it while this page is open.
  await sendProposal(leadId);

  type("A note to the lead", "One more thought.");
  fireEvent.click(button("Save draft"));

  await screen.findByText(/This proposal had changed elsewhere/);
  await waitFor(() => expect(chips()[0]).toBe("Proposal: Sent"));
  expect(screen.queryByRole("textbox")).toBeNull();
  noButton("Save draft");
  expect((await getProposal(leadId)).proposal?.context).not.toBe(
    "One more thought.",
  );
});

test("when a save fails nothing is lost, a message says so and Try again repeats it", async () => {
  const leadId = await open("Kwame Asante");
  api.fail("PUT", /^\/api\/proposals\//);

  type("A note to the lead", "Kept while it failed.");
  fireEvent.click(button("Save draft"));
  await screen.findByText(
    "That did not go through. The proposal is unchanged.",
  );
  expect(field("A note to the lead").value).toBe("Kept while it failed.");
  expect((await getProposal(leadId)).proposal?.context).not.toBe(
    "Kept while it failed.",
  );

  api.restore();
  fireEvent.click(button("Try again"));
  await screen.findByText("Draft saved");
  expect(screen.queryByText(/did not go through/)).toBeNull();
  expect((await getProposal(leadId)).proposal?.context).toBe(
    "Kept while it failed.",
  );
});

test("a lost proposal, and a proposal whose lead left the pipeline, are read-only and offer nothing to simulate", async () => {
  await open("Seraphina Duarte");
  expect(chips()[0]).toBe("Proposal: Lost");
  expect(
    panel("Status").getByText(/This lead left the pipeline: Lead Lost\./),
  ).toBeDefined();
  await viewerKnown();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("heading", { name: /^Simulate/ })).toBeNull();
  expect(screen.queryAllByRole("button")).toEqual([]);
  expect(previewed().length).toBeGreaterThan(2);

  cleanup();
  const leadId = await leadIdOf("Viktor Novak");
  await markLost(leadId, {});
  await open("Viktor Novak");
  await viewerKnown();
  expect(chips()[0]).toBe("Proposal: Draft");
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryAllByRole("button")).toEqual([]);
});

// --- not found, loading, failing -------------------------------------------------------

test("an unknown lead, and another rep's lead for staff, show not found with a way back to the picker", async () => {
  resetNavigation(`${BUILDER}?lead=lead-999`);
  renderScreen(<ProposalBuilderScreen />);
  await screen.findByText("This lead does not exist");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(
    screen.getByRole("link", { name: "Choose a lead" }).getAttribute("href"),
  ).toBe(BUILDER);

  // When the server already knows, nothing is requested at all.
  cleanup();
  vi.mocked(fetch).mockClear();
  renderScreen(<ProposalBuilderScreen missing />);
  expect(screen.getByText("This lead does not exist")).toBeDefined();
  expect(fetch).not.toHaveBeenCalled();

  cleanup();
  const kwame = await leadIdOf("Kwame Asante");
  viewAs("staff");
  resetNavigation(`${BUILDER}?lead=${kwame}`);
  renderScreen(<ProposalBuilderScreen />);
  await screen.findByText("This lead does not exist");
});

test("loading shows a skeleton; a failed load shows the error state with Try again", async () => {
  const leadId = await leadIdOf("Kwame Asante");
  api.fail("GET", /^\/api\/proposals\/lead-/);
  resetNavigation(`${BUILDER}?lead=${leadId}`);
  renderScreen(<ProposalBuilderScreen />);

  expect(
    screen.getByRole("status", { name: "Loading proposal" }),
  ).toBeDefined();
  await screen.findByText("This proposal could not be loaded");
  expect(screen.getByRole("alert")).toBeDefined();

  api.restore();
  fireEvent.click(button("Try again"));
  await screen.findByRole("heading", {
    level: 1,
    name: "Proposal for Kwame Asante",
  });
});
