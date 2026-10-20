import { z } from "zod";

/*
 * The two roles (spec 01): `profiles.role`, admin or rep. The screens use
 * these to leave out what a role cannot use; access itself is decided by the
 * guards in src/lib/data/users.ts. Client-safe: no server-only imports
 * (ADR-0003).
 */

export const ROLES = ["admin", "rep"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  rep: "Rep",
};

/** One line per role: what it sees (the registry's nav gating matrix). */
export const ROLE_SEES: Record<Role, string> = {
  admin: "Every lead, plus reps and connections",
  rep: "Only the leads assigned to them",
};

export const CAPABILITIES = [
  /** Every lead, and the filter by rep. */
  "see_all_leads",
  "manage_users",
  "manage_connections",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** Reps work their own leads; admins see every lead and run the Admin group. */
const ALLOWED: Record<Role, readonly Capability[]> = {
  admin: CAPABILITIES,
  rep: [],
};

export const can = (role: Role, capability: Capability) =>
  ALLOWED[role].includes(capability);

/** What GET /api/viewer returns: the role the screens draw for. */
export const viewerSchema = z.object({
  role: roleSchema,
  /** True while the app runs on sample data (drives sample-only controls). */
  preview: z.boolean(),
});
export type ViewerSummary = z.infer<typeof viewerSchema>;
