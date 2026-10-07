import { cookies } from "next/headers";

import type { CurrentUser } from "@/lib/auth/schemas";
import { SAMPLE_DATA } from "@/lib/data/sample";
import { AccessError, requireUser } from "@/lib/data/users";
import {
  type Capability,
  can,
  type PreviewRoleInput,
  type Role,
  roleSchema,
  type ViewerSummary,
} from "@/lib/roles";

/*
 * Who is asking, and as which role (spec 12; question 7, ASSUMED).
 *
 * THE SEAM. `getViewer` is the one function that resolves the viewer's role.
 * Today there is no Workspace membership, so it returns the role being
 * PREVIEWED: a cookie set by the "Viewing as" control, honoured only while the
 * dashboard runs on sample data. Going live means replacing `resolveRole` with
 * a read of the user's membership and deleting the preview. Screens, hooks and
 * handlers ask this module and never read the cookie.
 *
 * The preview is not access control. The real guard is `requireUser`, which
 * `getViewer` calls first; a role here only narrows what sample data is shown.
 */

export const PREVIEW_ROLE_COOKIE = "dw_preview_role";

/** With no preview chosen the viewer sees everything, as before roles existed. */
const DEFAULT_ROLE: Role = "owner";

/**
 * A Staff preview needs leads that are "theirs". The signed-in person owns no
 * sample lead, so Staff is shown one sample rep's leads. Change the rep here.
 */
export const PREVIEW_STAFF_REP = { id: "rep-maya", name: "Maya Okafor" };

export type Viewer = {
  user: CurrentUser;
  role: Role;
  /** The rep whose leads are this viewer's own; null when they own none. */
  repId: string | null;
};

async function resolveRole(): Promise<Role> {
  if (!SAMPLE_DATA) return DEFAULT_ROLE;
  const value = (await cookies()).get(PREVIEW_ROLE_COOKIE)?.value;
  return roleSchema.catch(DEFAULT_ROLE).parse(value);
}

/** The guard for role-aware data: authenticated with a profile, then the role. */
export async function getViewer(): Promise<Viewer> {
  const user = await requireUser();
  const role = await resolveRole();
  return {
    user,
    role,
    repId: role === "staff" ? PREVIEW_STAFF_REP.id : null,
  };
}

/** The guard for an admin resource: refuses with "forbidden" (403). */
export async function requireCapability(
  capability: Capability,
): Promise<Viewer> {
  const viewer = await getViewer();
  if (!can(viewer.role, capability)) throw new AccessError("forbidden");
  return viewer;
}

/**
 * The role rule for a lead (spec 12: "one function of role, user, resource"):
 * staff may see and act on only the leads they own.
 */
export function canSeeLead(viewer: Viewer, lead: { owner: { id: string } }) {
  return can(viewer.role, "see_all_leads") || lead.owner.id === viewer.repId;
}

/** For GET /api/viewer and the shell's prefetch. */
export async function getViewerSummary(): Promise<ViewerSummary> {
  const viewer = await getViewer();
  return {
    role: viewer.role,
    preview: SAMPLE_DATA,
    staffRep: viewer.role === "staff" ? PREVIEW_STAFF_REP : null,
  };
}

/** Preview only: remembers which role to show. Refused once data is real. */
export async function setPreviewRole(
  input: PreviewRoleInput,
): Promise<ViewerSummary> {
  await requireUser();
  if (!SAMPLE_DATA) throw new AccessError("forbidden");
  (await cookies()).set(PREVIEW_ROLE_COOKIE, input.role, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  return {
    role: input.role,
    preview: true,
    staffRep: input.role === "staff" ? PREVIEW_STAFF_REP : null,
  };
}
