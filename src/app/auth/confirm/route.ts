import { type NextRequest, NextResponse } from "next/server";

import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import { NOTICE } from "@/lib/auth/routing";
import { createClient } from "@/lib/supabase/server";

/**
 * Where every emailed link lands (sign-up confirmation and password reset).
 * Verifies the token hash with Supabase on the server, which sets the session
 * cookies, then redirects. Never renders a page or an error of its own.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const to = (path: string) =>
    NextResponse.redirect(new URL(path, request.nextUrl.origin));

  const failure =
    type === "recovery"
      ? `/reset-password?notice=${NOTICE.linkInvalid}`
      : `/sign-in?notice=${NOTICE.linkInvalid}`;

  if (!tokenHash || (type !== "email" && type !== "recovery")) {
    return to(failure);
  }

  let verified = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    verified = !error;
  } catch {
    // Supabase unreachable: the link was not verified, so treat it as invalid.
  }
  if (!verified) return to(failure);

  return to(
    type === "recovery"
      ? "/reset-password/update"
      : safeRedirectTarget(params.get("next")),
  );
}
