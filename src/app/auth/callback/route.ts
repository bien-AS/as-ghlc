import { type NextRequest, NextResponse } from "next/server";

import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import { NOTICE } from "@/lib/auth/routing";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Google returns. Exchanges the one-time code for a session on the
 * server, which sets the session cookies, then redirects. The dashboard gate
 * sends a first-time person on to profile setup.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const to = (path: string) =>
    NextResponse.redirect(new URL(path, request.nextUrl.origin));

  let signedIn = false;
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      signedIn = !error;
    } catch {
      // Supabase unreachable: no session was established.
    }
  }

  return to(
    signedIn
      ? safeRedirectTarget(params.get("next"))
      : `/sign-in?notice=${NOTICE.googleFailed}`,
  );
}
