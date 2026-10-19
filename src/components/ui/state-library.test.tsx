import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import AppError from "@/app/(app)/error";
import RootError from "@/app/error";
import NotFound from "@/app/not-found";
import { OfflineBanner } from "@/components/ui/offline-banner";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
} from "@/components/ui/state-panel";

/*
 * The two state libraries (registry: empty-state-library,
 * error-state-library): one pattern each for empty, 404, 403, 500 and offline.
 */

beforeEach(() => {
  // jsdom has no matchMedia; the theme switch on the 404 and error pages reads it.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  setOnline(true);
});

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    value: online,
    configurable: true,
  });
}

test("an empty state cannot be drawn without saying which kind of empty it is", () => {
  // @ts-expect-error `variant` is required: there is no safe default.
  void (<EmptyState title="No leads yet" body="Nothing here." />);

  render(
    <>
      <EmptyState variant="empty" title="No leads yet" body="Nothing yet." />
      <EmptyState
        variant="filtered"
        title="No leads match"
        body="Nothing matches."
      />
      <EmptyState
        variant="notConnected"
        provider="CRM"
        title="Not connected yet"
        body="Connect it first."
      />
    </>,
  );
  // Filtered and not connected are said in words, not only by tone.
  expect(screen.getAllByText("Filtered view")).toHaveLength(1);
  expect(screen.getByText("Not connected").textContent).toContain("CRM");
  for (const state of document.querySelectorAll('[data-slot="empty-state"]')) {
    expect(state.className).toContain("border");
  }
});

test("a role-gated fetch that is refused says 'You do not have access', with the way back", () => {
  render(
    <ForbiddenState action={<a href="/dashboard">Go to the dashboard</a>} />,
  );
  expect(screen.getByText("You do not have access")).toBeDefined();
  expect(
    screen
      .getByRole("link", { name: "Go to the dashboard" })
      .getAttribute("href"),
  ).toBe("/dashboard");
  // A refusal is a state, not an alarm.
  expect(screen.queryByRole("alert")).toBeNull();
});

test("an error state is announced and Try again calls the retry", () => {
  const onRetry = vi.fn();
  render(
    <ErrorState title="The leads could not be loaded" onRetry={onRetry} />,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "The leads could not be loaded",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("the offline banner follows the browser's offline and online events", () => {
  setOnline(true);
  render(<OfflineBanner />);
  const region = screen.getByRole("status");
  expect(region.textContent).toBe("");

  act(() => {
    setOnline(false);
    window.dispatchEvent(new Event("offline"));
  });
  expect(region.textContent).toContain("You are offline.");
  expect(region.textContent).toContain(
    "Changes cannot be saved until the connection is back.",
  );

  act(() => {
    setOnline(true);
    window.dispatchEvent(new Event("online"));
  });
  expect(region.textContent).toBe("");
});

test("a page that is not there says so and leads to the dashboard", () => {
  render(<NotFound />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeDefined();
  expect(
    screen
      .getByRole("link", { name: "Go to the dashboard" })
      .getAttribute("href"),
  ).toBe("/dashboard");
});

test.each([
  ["inside the shell", AppError, "This page could not be loaded"],
  ["outside the shell", RootError, "Something went wrong"],
])(
  "the error boundary %s offers Try again, which retries, and the dashboard",
  (_where, Boundary, title) => {
    const retry = vi.fn();
    render(<Boundary retry={retry} />);
    expect(screen.getByText(title)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("link", { name: "Go to the dashboard" })
        .getAttribute("href"),
    ).toBe("/dashboard");
  },
);
