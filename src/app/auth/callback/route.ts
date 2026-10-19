import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import {
  accessDenied,
  DENIED,
  type DeniedReason,
  NOTICE,
  rememberedPage,
} from "@/lib/auth/routing";
import { COMPANY_DOMAIN, getSignInProfile } from "@/lib/data/users";
import { isLive } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";

/** ADR-0008 check 1: Google verified the address, and it is a company one. */
function isCompanyAddress(user: User) {
  const google = user.identities?.find((i) => i.provider === "google");
  const email = google?.identity_data?.email;
  return (
    google?.identity_data?.email_verified === true &&
    typeof email === "string" &&
    email.toLowerCase().endsWith(COMPANY_DOMAIN)
  );
}

/**
 * Where Google returns (spec 01 section 5, ADR-0008). Exchanges the one-time
 * code for a session, then lets the person in only when Google verified a
 * company address, a profile was provisioned for this auth user, and it is
 * active. Any refusal signs out first, then names the failed check on
 * /access-denied. The `hd` parameter sent to Google is a convenience; this is
 * the control.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const to = (path: string) =>
    NextResponse.redirect(new URL(path, request.nextUrl.origin));
  const failed = `/login?notice=${NOTICE.googleFailed}`;

  // Cancelled at Google, or a bad code: no session was established.
  if (!code) return to(failed);
  const supabase = await createClient();
  let user: User | null = null;
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) user = data.user;
  } catch {
    // Supabase unreachable.
  }
  if (!user) return to(failed);

  const refuse = async (path: string) => {
    // A failed sign-out still leaves every guard refusing this session.
    await supabase.auth.signOut().catch(() => {});
    return to(path);
  };

  let reason: DeniedReason | null = null;
  let firstRun = false;
  try {
    if (!isCompanyAddress(user)) reason = DENIED.notCompany;
    else {
      const profile = await getSignInProfile(user.id);
      if (!profile) reason = DENIED.notProvisioned;
      else if (!profile.active) reason = DENIED.deactivated;
      else firstRun = profile.firstRun;
    }
  } catch {
    // The profile could not be read: fail closed.
    return refuse(failed);
  }
  if (reason) return refuse(accessDenied(reason));

  // /welcome is a P2 screen: until it is live (spec 01 section 3), first run lands on the dashboard.
  const home =
    firstRun && isLive("welcome-first-run") ? "/welcome" : "/dashboard";
  return to(rememberedPage(params.get("next")) ?? home);
}
