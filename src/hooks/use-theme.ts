"use client";

import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

/** Shared with the inline script in src/app/layout.tsx; keep the two in step. */
export const THEME_STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Storage blocked or unreadable: the spec's fallback is System.
    return "system";
  }
}

export function applyTheme(theme: Theme = readTheme()) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Not persisted; still applied for this page view.
  }
  applyTheme(theme);
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  const sync = () => {
    applyTheme();
    onChange();
  };
  const media = window.matchMedia(DARK_QUERY);
  listeners.add(onChange);
  media.addEventListener("change", sync); // device setting changed
  window.addEventListener("storage", sync); // changed in another tab
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", sync);
    window.removeEventListener("storage", sync);
  };
}

/** The stored choice. The server and the first client render see "system". */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "system");
}
