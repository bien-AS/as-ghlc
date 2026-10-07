import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { cleanAuthAddress, decideRedirect } from "@/lib/auth/routing";

/**
 * Runs before every matched request (Next.js 16 "proxy", formerly middleware).
 *
 * 1. Refreshes the Supabase session and writes the new cookies to both the
 *    request (so this render sees them) and the response (so the browser
 *    keeps them). Server Components cannot set cookies, so this is the only
 *    place a refresh can be persisted during a page load.
 * 2. Redirects signed-out visitors according to the "who is sent where" table.
 *    It is the one place that knows the requested address, so it is what
 *    remembers the page for /dashboard and everything below it.
 *
 * 0. Strips every query parameter except a valid `next` and `notice` from the
 *    auth pages, so a leaked form field never stays in the address bar.
 *
 * It does not read the database and logs nothing. Whether a signed-in person has a profile is
 * decided by `enforceRoute` in the pages and by the data-access guards.
 */
export async function proxy(request: NextRequest) {
  // Before anything else, and before anything could read or log the address:
  // an auth page never keeps form fields (a password above all) in its query.
  const clean = cleanAuthAddress(
    request.nextUrl.pathname,
    request.nextUrl.search,
  );
  if (clean) {
    return NextResponse.redirect(new URL(clean, request.nextUrl.origin), 303);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Verifies the token's signature; do not put code between the client and this call.
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) return response;

  const { pathname, search } = request.nextUrl;
  const destination = decideRedirect(`${pathname}${search}`, "signed-out");
  if (!destination) return response;

  const redirect = NextResponse.redirect(
    new URL(destination, request.nextUrl.origin),
  );
  // Keep any cookie changes (for example a cleared, expired session).
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
