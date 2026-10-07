import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import LandingPage from "./page";

beforeEach(() => {
  // jsdom has no matchMedia; the theme switch asks for the device setting.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  localStorage.clear();
});
afterEach(cleanup);

const STAGES = [
  "New lead",
  "Discovery Call Booked",
  "Qualified",
  "Proposal Review Booked",
  "Proposal Sent",
  "Lead Won",
];

test("the one h1 is the owner's headline", () => {
  render(<LandingPage />);

  const headings = screen.getAllByRole("heading", { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0].textContent).toBe(
    "From new lead to signed proposal, in one place.",
  );
});

test("every Sign up is a link to /sign-up and every Sign in a link to /sign-in", () => {
  render(<LandingPage />);

  const signUp = screen.getAllByRole("link", { name: "Sign up" });
  const signIn = screen.getAllByRole("link", { name: "Sign in" });
  // Nav, hero, closing call to action and footer; nav, closing and footer.
  expect(signUp.length).toBeGreaterThanOrEqual(4);
  expect(signIn.length).toBeGreaterThanOrEqual(3);
  for (const link of signUp) expect(link.getAttribute("href")).toBe("/sign-up");
  for (const link of signIn) expect(link.getAttribute("href")).toBe("/sign-in");
  // They are links, not buttons that navigate.
  expect(screen.queryByRole("button", { name: /sign (up|in)/i })).toBeNull();
});

test("sections come in spec order, with no articles section", () => {
  render(<LandingPage />);

  const sections = screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
  expect(sections).toEqual([
    "One pipeline, six stages, three exits.",
    "How a lead becomes a signed proposal.",
    "Built around the lead in front of you.",
    "The AI flags. A person decides.",
    "Not a replacement for your CRM. It works on top of it.",
    "Dealwright in three numbers.",
    "Start with your next lead.",
    // The footer's two link columns.
    "Product",
    "Account",
  ]);
  expect(document.body.textContent).not.toMatch(/articles?|blog/i);
});

test("the pipeline strip lists exactly the six stages in order and the three exits", () => {
  render(<LandingPage />);

  const stages = within(
    screen.getByRole("list", { name: "Stages, in order" }),
  ).getAllByRole("listitem");
  // Each item is its position, then the stage's name as the glossary spells it.
  expect(stages.map((item) => item.textContent)).toEqual(
    STAGES.map((stage, index) => `${index + 1}${stage}`),
  );

  const exits = within(
    screen.getByRole("list", { name: "Exits" }),
  ).getAllByRole("listitem");
  expect(exits.map((item) => item.textContent)).toEqual([
    "Spam",
    "Nurture",
    "Lead Lost",
  ]);
});

test("the feature switcher keeps one item expanded and moves between headers with the keyboard", () => {
  render(<LandingPage />);

  const features = screen.getByRole("region", {
    name: "Built around the lead in front of you.",
  });
  const headers = within(features).getAllByRole("button");
  expect(headers.map((header) => header.textContent)).toEqual([
    "Pipeline",
    "Verdict",
    "Suspect review",
    "One next step",
  ]);
  const expanded = () =>
    headers.map((header) => header.getAttribute("aria-expanded"));
  const panelOf = (header: HTMLElement) =>
    document.getElementById(header.getAttribute("aria-controls") ?? "");

  // One item is open to begin with, and the closed panels are out of reach.
  expect(expanded()).toEqual(["true", "false", "false", "false"]);
  expect(panelOf(headers[0])?.hasAttribute("inert")).toBe(false);
  expect(panelOf(headers[1])?.hasAttribute("inert")).toBe(true);

  // Arrow keys, Home and End move focus between headers and wrap; they do not open anything.
  headers[0].focus();
  fireEvent.keyDown(headers[0], { key: "ArrowRight" });
  expect(document.activeElement).toBe(headers[1]);
  fireEvent.keyDown(headers[1], { key: "ArrowDown" });
  expect(document.activeElement).toBe(headers[2]);
  fireEvent.keyDown(headers[2], { key: "End" });
  expect(document.activeElement).toBe(headers[3]);
  fireEvent.keyDown(headers[3], { key: "ArrowRight" });
  expect(document.activeElement).toBe(headers[0]);
  fireEvent.keyDown(headers[0], { key: "ArrowLeft" });
  expect(document.activeElement).toBe(headers[3]);
  fireEvent.keyDown(headers[3], { key: "ArrowUp" });
  expect(document.activeElement).toBe(headers[2]);
  fireEvent.keyDown(headers[2], { key: "Home" });
  expect(document.activeElement).toBe(headers[0]);
  expect(expanded()).toEqual(["true", "false", "false", "false"]);

  // Activating a header (Enter and Space click a native button) opens it and closes the other.
  fireEvent.click(headers[2]);
  expect(expanded()).toEqual(["false", "false", "true", "false"]);
  expect(panelOf(headers[2])?.hasAttribute("inert")).toBe(false);
  expect(panelOf(headers[0])?.hasAttribute("inert")).toBe(true);
  expect(panelOf(headers[2])?.getAttribute("aria-labelledby")).toBe(
    headers[2].id,
  );

  // Activating the open one leaves it open: there is always one to look at.
  fireEvent.click(headers[2]);
  expect(expanded()).toEqual(["false", "false", "true", "false"]);
});

test("the page names Dealwright and Authority Solutions, and no other brand, and never ASCRM", () => {
  const { container } = render(<LandingPage />);

  expect(container.textContent).toContain("Dealwright");
  // Markup too, so alternative text and labels are covered, not only visible text.
  const markup = container.innerHTML;
  expect(markup).not.toMatch(/ascrm/i);
  expect(markup).not.toMatch(
    /\b(gohighlevel|highlevel|ghl|hubspot|salesforce|pipedrive|zoho|keap|close\.com|monday\.com|stripe|quickbooks|xero|docusign|pandadoc|openai|chatgpt|anthropic|claude|gemini|supabase|vercel|trajectory)\b/i,
  );

  // The only logo is the endorsement, and it is not shown in the dark band.
  const logos = screen.getAllByRole("img", { name: "Authority Solutions" });
  expect(logos.length).toBeGreaterThan(0);
  const band = screen.getByRole("region", {
    name: "Not a replacement for your CRM. It works on top of it.",
  });
  expect(
    within(band).queryByRole("img", { name: "Authority Solutions" }),
  ).toBeNull();
});

test("nothing is claimed as live or measured, and planned capabilities say Planned", () => {
  const { container } = render(<LandingPage />);

  expect(container.textContent).not.toMatch(
    /available now|\blive\b|in use by|trusted by|customers|testimonial|\d\s?%|\$\d/i,
  );

  for (const name of [
    "Built around the lead in front of you.",
    "The AI flags. A person decides.",
    "Not a replacement for your CRM. It works on top of it.",
  ]) {
    const section = screen.getByRole("region", { name });
    expect(within(section).getAllByText("Planned").length).toBeGreaterThan(0);
  }

  // In the band, each planned kind of service carries the label; the built ones do not.
  const band = screen.getByRole("region", {
    name: "Not a replacement for your CRM. It works on top of it.",
  });
  const kinds = within(
    within(band).getByRole("group", { name: "What Dealwright connects to" }),
  )
    .getAllByRole("listitem")
    .map((item) => item.textContent);
  expect(kinds).toEqual([
    "Your CRM",
    "AI research",
    "DecksPlanned",
    "ProposalsPlanned",
    "InvoicingPlanned",
  ]);
});

test("the footer links only to sections of this page and to pages that exist", () => {
  render(<LandingPage />);

  const hrefs = within(screen.getByRole("contentinfo"))
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
  expect(hrefs).toEqual([
    "#how-it-works",
    "#features",
    "#control",
    "/sign-in",
    "/sign-up",
    "/reset-password",
  ]);
  for (const id of ["how-it-works", "features", "control"]) {
    expect(document.getElementById(id)).not.toBeNull();
  }
});

test("a skip link is the first thing focus reaches and points at the main area", () => {
  render(<LandingPage />);

  const first = screen.getAllByRole("link")[0];
  expect(first.textContent).toBe("Skip to content");
  expect(first.getAttribute("href")).toBe("#main-content");
  expect(screen.getByRole("main").id).toBe("main-content");
});
