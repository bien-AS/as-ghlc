import { useSyncExternalStore } from "react";
import { vi } from "vitest";

/*
 * A stand-in for next/navigation in page-level tests: an address the test can
 * read, and a router whose push and replace move it. It imports nothing from
 * the app, so it is safe to load from inside a vi.mock factory:
 *   vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationModule);
 */

const ORIGIN = "http://localhost:3000";

let url = new URL(`${ORIGIN}/dashboard`);
const listeners = new Set<() => void>();
const go = (href: string) => {
  url = new URL(href, ORIGIN);
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const router = {
  push: vi.fn(go),
  replace: vi.fn(go),
  back: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

/** Where the app is now, as "/path?query". */
export const address = () => `${url.pathname}${url.search}`;

let params = new URLSearchParams();
let paramsFor = "";

export const navigationModule = {
  useRouter: () => router,
  usePathname: () =>
    useSyncExternalStore(
      subscribe,
      () => url.pathname,
      () => url.pathname,
    ),
  useSearchParams: () =>
    useSyncExternalStore(subscribe, () => {
      // The same object until the query changes, as the real hook gives.
      if (paramsFor !== url.search) {
        paramsFor = url.search;
        params = new URLSearchParams(url.search);
      }
      return params;
    }),
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
};

/** Call in `beforeEach`: a fresh address and a router with no calls recorded. */
export function resetNavigation(at: string) {
  url = new URL(at, ORIGIN);
  listeners.clear();
  for (const mock of Object.values(router)) mock.mockClear();
}
