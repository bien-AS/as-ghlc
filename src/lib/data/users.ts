import { redirect } from "next/navigation";
import { cache } from "react";

import { type AuthStatus, decideRedirect } from "@/lib/auth/routing";
import {
  type CurrentUser,
  type ProfileInput,
  profileSchema,
} from "@/lib/auth/schemas";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/*
 * Data access for the User resource, and the shared guards every other
 * data-access function calls first (ADR-0002, AGENTS.md).
 *
 * Server only: this module reads the session cookies and the database. The
 * ownership half of the guard (membership of the owning Workspace) has nothing
 * to check until spec 12; `requireUser` is where it will go.
 */

/** Sign-up stores the typed names on the auth user under keys Google does not use. */
export const SIGN_UP_NAME_KEYS = {
  firstName: "dw_first_name",
  lastName: "dw_last_name",
} as const;

/** What the verified session says about the person. Never built from client input. */
export type SessionIdentity = {
  id: string;
  email: string;
  /** Both names typed at email sign-up, when present and valid. */
  signUpNames: ProfileInput | null;
  /** Best guess for prefilling the form (sign-up names, else the Google profile). */
  suggestedNames: { firstName: string; lastName: string };
  /** How this session was established, from the token's `amr` claim. */
  methods: string[];
};

export type CurrentUserResult =
  | { status: "signed-out" }
  | { status: "no-profile"; identity: SessionIdentity }
  | { status: "ready"; identity: SessionIdentity; user: CurrentUser };

export type AccessErrorCode =
  | "unauthenticated"
  | "profile_required"
  | "email_conflict"
  // The resource does not exist, or its current state does not allow the write.
  | "not_found"
  | "conflict"
  // Signed in, but the role does not allow this resource (spec 12).
  | "forbidden";

/** A data-access function refused. Route Handlers turn the code into 401 / 403 / 404 / 409. */
export class AccessError extends Error {
  constructor(readonly code: AccessErrorCode) {
    super(code);
    this.name = "AccessError";
  }
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

function suggestNames(meta: Record<string, unknown>) {
  const firstName =
    text(meta[SIGN_UP_NAME_KEYS.firstName]) || text(meta.given_name);
  const lastName =
    text(meta[SIGN_UP_NAME_KEYS.lastName]) || text(meta.family_name);
  if (firstName || lastName) return { firstName, lastName };
  // Google supplies one display name; the person checks the split on the form.
  const [first = "", ...rest] = (text(meta.full_name) || text(meta.name))
    .split(/\s+/)
    .filter(Boolean);
  return { firstName: first, lastName: rest.join(" ") };
}

/**
 * Verifies the session with Supabase (`getClaims` checks the token's signature
 * against the project's keys and refreshes an expired session) and reads the
 * identity from the verified claims.
 */
async function getSessionIdentity(): Promise<SessionIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || typeof claims.email !== "string") return null;
  if (!claims.email) return null;

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const names = profileSchema.safeParse({
    firstName: meta[SIGN_UP_NAME_KEYS.firstName],
    lastName: meta[SIGN_UP_NAME_KEYS.lastName],
  });
  const methods = (claims.amr ?? []).map((entry) =>
    typeof entry === "string" ? entry : entry.method,
  );

  return {
    id: claims.sub,
    email: claims.email,
    signUpNames: names.success ? names.data : null,
    suggestedNames: suggestNames(meta),
    methods,
  };
}

/**
 * The current-user resolver: signed out, signed in without a profile, or the
 * User. One read by primary key, because User.id is the auth user id
 * (ADR-0005). Memoised for the length of one server render.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUserResult> => {
  const identity = await getSessionIdentity();
  if (!identity) return { status: "signed-out" };

  const user = await prisma.user.findUnique({ where: { id: identity.id } });
  return user
    ? { status: "ready", identity, user }
    : { status: "no-profile", identity };
});

/**
 * The guard for application data: authenticated, then has a profile. Every
 * data-access function that serves application data starts here, and a Route
 * Handler that takes input calls it before reading that input, so the order
 * of refusals is always 401, 403, then 400.
 *
 * ponytail: outside a server render `cache` does not memoise, so such a
 * handler resolves the session twice (here and in the data function): one
 * extra token check and one read by primary key. Pass the resolved user into
 * the data functions if that ever shows up in timings.
 */
export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (current.status === "signed-out") throw new AccessError("unauthenticated");
  if (current.status === "no-profile") {
    throw new AccessError("profile_required");
  }
  return current.user;
}

/**
 * The guard for the one write a person without a profile may make (creating
 * it): authenticated, and nothing more.
 */
export async function requireSession(): Promise<
  Exclude<CurrentUserResult, { status: "signed-out" }>
> {
  const current = await getCurrentUser();
  if (current.status === "signed-out") throw new AccessError("unauthenticated");
  return current;
}

/** The current User, for GET /api/me and for server prefetch (ADR-0001). */
export async function getMe(): Promise<CurrentUser> {
  return requireUser();
}

/**
 * Creates the User row for the signed-in person. The id and email come from
 * the verified session and nowhere else; `input` supplies the two names only,
 * and any other property on it is ignored. Safe to call twice.
 */
export async function createProfile(input: ProfileInput): Promise<CurrentUser> {
  const current = await requireSession();
  if (current.status === "ready") return current.user;

  const { id, email } = current.identity;
  try {
    return await prisma.user.create({
      data: {
        id,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code !== "P2002") throw error;
    // Unique violation: either a second submit won the race (same id, fine),
    // or another profile already uses this email.
    const existing = await prisma.user.findUnique({ where: { id } });
    if (existing) return existing;
    throw new AccessError("email_conflict");
  }
}

/**
 * Changes the signed-in person's own name (Account settings). The row is found
 * by the verified session's id and nowhere else; `input` supplies the two
 * names only, so the email and the id cannot be changed here.
 */
export async function updateProfile(input: ProfileInput): Promise<CurrentUser> {
  const user = await requireUser();
  return prisma.user.update({
    where: { id: user.id },
    data: { firstName: input.firstName, lastName: input.lastName },
  });
}

/**
 * The silent-path rule (spec 02): the names for a profile that may be created
 * without showing the form, or null when the form must be shown. Only for a
 * session established by an emailed link or by email and password, never one
 * established through Google, and only when sign-up supplied both names.
 */
export function silentProfileNames(
  identity: SessionIdentity,
): ProfileInput | null {
  if (identity.methods.includes("oauth")) return null;
  const byEmail = identity.methods.some(
    (method) => method === "otp" || method === "password",
  );
  return byEmail ? identity.signUpNames : null;
}

/** What may be logged about a failure: what kind it was, never what it said. */
function describeFailure(error: unknown) {
  const e = error as { name?: unknown; code?: unknown } | null;
  return {
    // A class name ("PrismaClientKnownRequestError") and a code ("P2002",
    // "email_conflict"). Never the message: it can quote the values involved.
    name: typeof e?.name === "string" ? e.name : typeof error,
    code: typeof e?.code === "string" ? e.code : undefined,
  };
}

/**
 * The silent path (spec 02), as a write the browser asks for with POST: it is
 * never a side effect of rendering a page, so a prefetch or a speculative
 * render cannot create a profile. Applies `silentProfileNames` to the
 * verified session; the caller supplies nothing.
 *
 * Returns the User (created now, or already there), or null when the form
 * must be shown: the rule does not allow it, or the write failed. A failure
 * is logged with the step and the kind of error only, never personal data.
 */
export async function createProfileSilently(): Promise<CurrentUser | null> {
  let step = "resolve-session";
  try {
    const current = await getCurrentUser();
    if (current.status === "signed-out") {
      throw new AccessError("unauthenticated");
    }
    if (current.status === "ready") return current.user;

    const names = silentProfileNames(current.identity);
    if (!names) return null;

    step = "create-profile";
    return await createProfile(names);
  } catch (error) {
    if (error instanceof AccessError && error.code === "unauthenticated") {
      throw error;
    }
    console.error("[profile-setup] silent profile creation failed", {
      step,
      ...describeFailure(error),
    });
    return null;
  }
}

/**
 * Applies the "who is sent where" table to a page: redirects when the table
 * says so, otherwise returns the resolved state for the page to render from.
 * Call it at the top of every page and layout that the table mentions.
 */
export async function enforceRoute(path: string): Promise<CurrentUserResult> {
  const current = await getCurrentUser();
  const destination = decideRedirect(path, current.status satisfies AuthStatus);
  if (destination) redirect(destination);
  return current;
}
