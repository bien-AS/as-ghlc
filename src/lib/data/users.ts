import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db/client";
import { profiles } from "@/db/schema";

import { type AuthStatus, decideRedirect } from "@/lib/auth/routing";
import type { CurrentUser, ProfileInput } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

/*
 * Data access for the signed-in person's profile, and THE GUARDS (spec 01
 * section 4; ADR-0002). Every data-access function calls one first:
 *
 *  - `requireProfile()`: a verified session and an active profile;
 *  - `requireAdmin()`: the same, with the admin role;
 *  - `leadScope(profile)`, applied by every lead read: an admin sees every
 *    lead, a rep only the leads assigned to them. Anything that belongs to a
 *    lead is reached through the lead, so through its scope.
 *
 * Profiles are created only by provisioning (ADR-0008: `pnpm seed:admins`,
 * then the admin screen in spec 15), never by the person signing in.
 *
 * Server only: this module reads the session cookies and the database.
 */

/** The signed-in person's profile row, as the guards read it. */
export type Profile = CurrentUser & {
  role: "admin" | "rep";
  active: boolean;
};

export type CurrentUserResult =
  | { status: "signed-out" }
  | { status: "no-profile" }
  | { status: "ready"; user: Profile };

export type AccessErrorCode =
  | "unauthenticated"
  | "profile_required"
  // The resource does not exist, or its current state does not allow the write.
  | "not_found"
  | "conflict"
  // Signed in, but the role does not allow this, or the profile is deactivated.
  | "forbidden";

/** A data-access function refused. Route Handlers turn the code into 401 / 403 / 404 / 409. */
export class AccessError extends Error {
  constructor(readonly code: AccessErrorCode) {
    super(code);
    this.name = "AccessError";
  }
}

/**
 * Verifies the session with Supabase (`getClaims` checks the token's signature
 * against the project's keys and refreshes an expired session) and returns the
 * auth user id from the verified claims.
 */
async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || typeof claims.email !== "string") return null;
  if (!claims.email) return null;
  return claims.sub;
}

/** The profile columns a CurrentUser carries. */
const CURRENT_USER = {
  id: profiles.id,
  email: profiles.email,
  firstName: profiles.firstName,
  lastName: profiles.lastName,
};

const findProfile = (id: string): Promise<Profile | undefined> =>
  db.query.profiles.findFirst({
    where: eq(profiles.id, id),
    columns: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      active: true,
    },
  });

const toCurrentUser = ({ id, email, firstName, lastName }: CurrentUser) => ({
  id,
  email,
  firstName,
  lastName,
});

/**
 * The current-user resolver: signed out, signed in without a profile, or the
 * profile. One read by primary key, because profiles.id is the auth user id
 * (ADR-0008). Memoised for the length of one server render.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUserResult> => {
  const id = await getSessionUserId();
  if (!id) return { status: "signed-out" };

  const user = await findProfile(id);
  return user ? { status: "ready", user } : { status: "no-profile" };
});

/**
 * The guard for application data: a verified session, a profile, and the
 * profile active (ADR-0008: a deactivated rep's next request is refused). Every
 * data-access function starts here, and a Route Handler that takes input calls
 * it before reading that input, so the order of refusals is always 401, 403,
 * then 400.
 *
 * ponytail: outside a server render `cache` does not memoise, so such a
 * handler resolves the session twice (here and in the data function): one
 * extra token check and one read by primary key. Pass the resolved profile
 * into the data functions if that ever shows up in timings.
 */
export async function requireProfile(): Promise<Profile> {
  const current = await getCurrentUser();
  if (current.status === "signed-out") throw new AccessError("unauthenticated");
  if (current.status === "no-profile") {
    throw new AccessError("profile_required");
  }
  if (!current.user.active) throw new AccessError("forbidden");
  return current.user;
}

/** The guard for the admin cluster (reps, integrations) and invoice actions. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new AccessError("forbidden");
  return profile;
}

/**
 * The leads a profile may reach: an admin every lead, a rep only those
 * assigned to them. ponytail: a predicate over the sample leads (ADR-0006);
 * it becomes `eq(leads.assignedTo, profile.id)` (or nothing, for an admin)
 * when leads are read from the table (spec 06).
 */
export const leadScope =
  (profile: Profile) =>
  (lead: { owner: { id: string } }): boolean =>
    profile.role === "admin" || lead.owner.id === profile.id;

/**
 * What /auth/callback checks after the code exchange (ADR-0008): whether the
 * auth user has a provisioned profile, whether it is active, and whether this
 * is the first sign-in. The one read made without a guard, because it is the
 * gate itself; the id comes from the session the exchange just established.
 */
export const getSignInProfile = (authUserId: string) =>
  db.query.profiles.findFirst({
    where: eq(profiles.id, authUserId),
    columns: { active: true, firstRun: true },
  });

/** The current User, for GET /api/me and for server prefetch (ADR-0001). */
export async function getMe(): Promise<CurrentUser> {
  return toCurrentUser(await requireProfile());
}

/**
 * Changes the signed-in person's own name (Account settings). The row is found
 * by the verified session's id and nowhere else; `input` supplies the two
 * names only, so the email and the id cannot be changed here.
 */
export async function updateProfile(input: ProfileInput): Promise<CurrentUser> {
  const user = await requireProfile();
  const [updated] = await db
    .update(profiles)
    .set({ firstName: input.firstName, lastName: input.lastName })
    .where(eq(profiles.id, user.id))
    .returning(CURRENT_USER);
  return updated;
}

const statusOf = (current: CurrentUserResult): AuthStatus =>
  current.status === "ready" && !current.user.active
    ? "inactive"
    : current.status;

/**
 * Applies the "who is sent where" table to a page: redirects when the table
 * says so, otherwise returns the resolved state for the page to render from.
 * Call it at the top of every page and layout that the table mentions.
 */
export async function enforceRoute(path: string): Promise<CurrentUserResult> {
  const current = await getCurrentUser();
  const destination = decideRedirect(path, statusOf(current));
  if (destination) redirect(destination);
  return current;
}
