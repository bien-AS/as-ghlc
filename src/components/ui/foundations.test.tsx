import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "@/components/ui/theme-switch";

beforeEach(() => {
  // jsdom has no matchMedia; the device prefers light here.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  localStorage.clear();
  document.documentElement.className = "";
});
afterEach(cleanup);

test("theme switch offers System, Light and Dark, applies and stores the choice", () => {
  render(<ThemeSwitch />);

  expect(screen.getByRole("group", { name: "Theme" })).toBeDefined();
  const system = screen.getByRole<HTMLInputElement>("radio", {
    name: "System",
  });
  const dark = screen.getByRole<HTMLInputElement>("radio", { name: "Dark" });
  expect(screen.getByRole("radio", { name: "Light" })).toBeDefined();
  expect(system.checked).toBe(true);

  fireEvent.click(dark);
  expect(dark.checked).toBe(true);
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("theme")).toBe("dark");

  fireEvent.click(system);
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(localStorage.getItem("theme")).toBeNull();
});

test("two theme switches on one page each show the choice, each take focus, and stay in step", () => {
  render(
    <>
      <nav aria-label="First">
        <ThemeSwitch />
      </nav>
      <footer>
        <ThemeSwitch />
      </footer>
    </>,
  );

  const groups = screen.getAllByRole("group", { name: "Theme" });
  expect(groups).toHaveLength(2);
  const radio = (group: HTMLElement, name: string) =>
    within(group).getByRole<HTMLInputElement>("radio", { name });

  // Each switch is its own radio group, so each has a checked radio (and a tab stop) of its own.
  const names = groups.map((group) => radio(group, "System").name);
  expect(new Set(names).size).toBe(2);
  for (const group of groups) {
    expect(radio(group, "System").checked).toBe(true);
    expect(
      within(group)
        .getAllByRole<HTMLInputElement>("radio")
        .filter((input) => input.checked),
    ).toHaveLength(1);
  }

  // Choosing in one is shown in both.
  fireEvent.click(radio(groups[0], "Dark"));
  for (const group of groups) {
    expect(radio(group, "Dark").checked).toBe(true);
    expect(radio(group, "System").checked).toBe(false);
  }
  expect(document.documentElement.classList.contains("dark")).toBe(true);

  fireEvent.click(radio(groups[1], "Light"));
  for (const group of groups) {
    expect(radio(group, "Light").checked).toBe(true);
    expect(radio(group, "Dark").checked).toBe(false);
  }
  expect(document.documentElement.classList.contains("dark")).toBe(false);
});

test("button kinds are buttons with their names; disabled and loading block a press", () => {
  const onClick = vi.fn();
  render(
    <>
      <Button variant="primary" onClick={onClick}>
        Send proposal
      </Button>
      <Button onClick={onClick}>Cancel</Button>
      <Button variant="danger" onClick={onClick}>
        Remove lead
      </Button>
      <Button disabled onClick={onClick}>
        Unavailable
      </Button>
      <Button loading onClick={onClick}>
        Saving
      </Button>
    </>,
  );

  for (const name of ["Send proposal", "Cancel", "Remove lead"]) {
    fireEvent.click(screen.getByRole("button", { name }));
  }
  expect(onClick).toHaveBeenCalledTimes(3);

  const disabled = screen.getByRole<HTMLButtonElement>("button", {
    name: "Unavailable",
  });
  expect(disabled.disabled).toBe(true);
  expect(disabled.className).toContain("disabled:opacity-40");

  const loading = screen.getByRole("button", { name: /Saving/ });
  expect(loading.getAttribute("aria-busy")).toBe("true");
  fireEvent.click(disabled);
  fireEvent.click(loading);
  expect(onClick).toHaveBeenCalledTimes(3);
});

test("chip tones carry their word, not only a colour", () => {
  render(
    <>
      <Badge variant="ok">Valid</Badge>
      <Badge variant="warn">Awaiting</Badge>
      <Badge variant="crit">Suspect</Badge>
      <Badge>Sample data</Badge>
    </>,
  );

  // A bare chip is the neutral tone, as a bare button is the neutral button.
  expect(screen.getByText("Sample data").className).toContain("bg-secondary");

  expect(screen.getByText("Valid").className).toContain("bg-ok-soft");
  expect(screen.getByText("Awaiting").className).toContain("bg-warn-soft");
  expect(screen.getByText("Suspect").className).toContain("bg-crit-soft");
});
