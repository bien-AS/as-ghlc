// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CommandPalette } from "./command-palette";

afterEach(cleanup);

// cmdk measures its list and scrolls the active row; jsdom has neither.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const groups = [
  {
    label: "Go to",
    items: [
      { label: "Pipeline", href: "/dashboard" },
      { label: "Notifications", href: "/dashboard/notifications" },
    ],
  },
];

const setup = () => {
  const onNavigate = vi.fn();
  const onSearch = vi.fn();
  render(
    <CommandPalette
      groups={groups}
      onNavigate={onNavigate}
      onSearch={onSearch}
    />,
  );
  return { onNavigate, onSearch };
};

it("opens on Ctrl+K and closes on a second press", () => {
  setup();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("navigates to the chosen destination", () => {
  const { onNavigate } = setup();
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  fireEvent.click(screen.getByText("Notifications"));
  expect(onNavigate).toHaveBeenCalledWith("/dashboard/notifications");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("offers a lead search for what was typed", () => {
  const { onSearch } = setup();
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "acme" } });
  fireEvent.click(screen.getByText(/Search leads for/));
  expect(onSearch).toHaveBeenCalledWith("acme");
});
