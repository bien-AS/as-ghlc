import { safeRedirectTarget } from "@/lib/auth/redirect-target";

/** The three answers of the current-user resolver (spec 02, "Who is sent where"). */
export type AuthStatus = "signed-out" | "no-profile" | "ready";

/** Short codes carried in the address by a redirect; never free text, never an email. */
export const NOTICE = {
  linkInvalid: "link_invalid",
  googleFailed: "google_failed",
  signedOut: "signed_out",
} as const;

const SIGNED_OUT_FORMS = ["/sign-in", "/sign-up", "/reset-password"];

/** Every page that holds an auth form. */
const AUTH_PAGES = [
  ...SIGNED_OUT_FORMS,
  "/reset-password/update",
  "/profile-setup",
];
const NOTICE_CODES: string[] = Object.values(NOTICE);

/**
 * Defence in depth for an address that carries form fields (a password, an
 * email, a name), which is what a form submitted by the browser itself with
 * GET would produce. An auth page accepts two query parameters and nothing
 * else: `next`, when it is a path inside the app, and `notice`, when it is one
 * of our codes. Returns the cleaned address to redirect to, or null when the
 * address is already clean or is not an auth page. Nothing is echoed or logged.
 */
export function cleanAuthAddress(pathname: string, search: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!AUTH_PAGES.includes(path)) return null;

  const given = new URLSearchParams(search);
  const kept = new URLSearchParams();
  const next = given.get("next");
  if (next && safeRedirectTarget(next) === next) kept.set("next", next);
  const notice = given.get("notice");
  if (notice && NOTICE_CODES.includes(notice)) kept.set("notice", notice);

  given.sort();
  kept.sort();
  if (given.toString() === kept.toString()) return null;
  const query = kept.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * The whole "who is sent where" table: where a request for `path` (a pathname,
 * optionally with its query) must be redirected for a session state, or null
 * when the route is shown. The proxy applies it for signed-out visitors (it is
 * the one place that knows the requested address); pages apply it again with
 * the full state through `enforceRoute`.
 *
 * Everything under /dashboard is covered by the prefix rule, so new dashboard
 * routes are protected without being listed here.
 */
export function decideRedirect(
  path: string,
  status: AuthStatus,
): string | null {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

  if (SIGNED_OUT_FORMS.includes(pathname)) {
    if (status === "no-profile") return "/profile-setup";
    if (status === "ready") return "/dashboard";
    return null;
  }

  if (pathname === "/reset-password/update") {
    return status === "signed-out"
      ? `/reset-password?notice=${NOTICE.linkInvalid}`
      : null;
  }

  if (pathname === "/profile-setup") {
    if (status === "signed-out") return "/sign-in";
    if (status === "ready") return "/dashboard";
    return null;
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (status === "signed-out") {
      return `/sign-in?next=${encodeURIComponent(path)}`;
    }
    if (status === "no-profile") return "/profile-setup";
    return null;
  }

  // "/", /auth/*, /api/* and anything else: never redirected here. API routes
  // refuse with 401 / 403 through the data-access guards instead.
  return null;
}
