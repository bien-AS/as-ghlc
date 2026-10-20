import { safeRedirectTarget } from "@/lib/auth/redirect-target";

/**
 * Where a request stands (spec 01 section 5): no session, a session with no
 * profile (not provisioned), a deactivated profile, or a profile that may use
 * the app.
 */
export type AuthStatus = "signed-out" | "no-profile" | "inactive" | "ready";

/** Short codes carried in the address by a redirect; never free text, never an email. */
export const NOTICE = { googleFailed: "google_failed" } as const;

/** Why /access-denied was reached: which of ADR-0008's three checks failed. */
export const DENIED = {
  notCompany: "not_company",
  notProvisioned: "not_provisioned",
  deactivated: "deactivated",
} as const;
export type DeniedReason = (typeof DENIED)[keyof typeof DENIED];

export const accessDenied = (reason: DeniedReason) =>
  `/access-denied?reason=${reason}`;

/**
 * The first segment of every registry screen in the (app) route group
 * (`screen-registry.json`). A signed-out visitor is sent to /login from any
 * address under one of them, so a screen added to the registry is protected
 * without being listed here.
 */
const APP_SECTIONS = [
  "/dashboard",
  "/leads",
  "/review-queue",
  "/pipeline",
  "/decks",
  "/proposals",
  "/invoices",
  "/recordings",
  "/notifications",
  "/reports",
  "/settings",
  "/welcome",
  "/admin",
];

const pathnameOf = (path: string) =>
  path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

const inApp = (path: string) => {
  const pathname = pathnameOf(path);
  return APP_SECTIONS.some(
    (section) => pathname === section || pathname.startsWith(`${section}/`),
  );
};

/** The remembered page, kept only when it is a safe path to an app screen. */
export function rememberedPage(value: string | null | undefined) {
  return value && safeRedirectTarget(value) === value && inApp(value)
    ? value
    : null;
}

/**
 * The whole "who is sent where" table: where a request for `path` (a pathname,
 * optionally with its query) must be redirected for a session state, or null
 * when the route is shown. The proxy applies it for signed-out visitors (it is
 * the one place that knows the requested address); pages apply it again with
 * the full state through `enforceRoute`.
 */
export function decideRedirect(
  path: string,
  status: AuthStatus,
): string | null {
  if (pathnameOf(path) === "/login") {
    return status === "ready" ? "/dashboard" : null;
  }

  if (inApp(path)) {
    if (status === "signed-out") {
      return `/login?next=${encodeURIComponent(path)}`;
    }
    if (status === "no-profile") return accessDenied(DENIED.notProvisioned);
    if (status === "inactive") return accessDenied(DENIED.deactivated);
    return null;
  }

  // "/", /access-denied, /auth/*, /api/* and anything else: never redirected
  // here. API routes refuse with 401 / 403 through the data-access guards.
  return null;
}
