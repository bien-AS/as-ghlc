import { z } from "zod";

/*
 * Roles and what each may do (spec 12, "Roles"). Question 7: the three role
 * names are decided; what each role sees and can do is PROPOSED, not decided.
 * This file is the one place that answer lives: the server's guards
 * (`src/lib/data/viewer.ts`) and the screens that hide what a role cannot use
 * both ask `can`. Client-safe: no server-only imports (ADR-0003).
 */

export const ROLES = ["owner", "admin", "staff"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

/** One line per role, as spec 12's table words it. */
export const ROLE_SEES: Record<Role, string> = {
  owner: "Everything in the Workspace",
  admin: "Every lead, plus users and connections",
  staff: "Only the leads assigned to them",
};

export const CAPABILITIES = [
  /** Every lead in the Workspace, and the filter by rep. */
  "see_all_leads",
  "manage_users",
  "manage_workspace",
  "manage_connections",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/**
 * Question 7 (proposed): staff work their own leads; admins and owners see
 * every lead and manage users, the Workspace and its connections. Spec 12
 * defines no owner-only setting, so Owner and Admin are the same here.
 */
const ALLOWED: Record<Role, readonly Capability[]> = {
  owner: CAPABILITIES,
  admin: CAPABILITIES,
  staff: [],
};

export const can = (role: Role, capability: Capability) =>
  ALLOWED[role].includes(capability);

/** What GET /api/viewer returns: the role the screens should draw for. */
export const viewerSchema = z.object({
  role: roleSchema,
  /** True while the role is a sample-data preview, not a real membership. */
  preview: z.boolean(),
  /** In a Staff preview, the sample rep whose leads are shown as "yours". */
  staffRep: z.object({ id: z.string(), name: z.string() }).nullable(),
});
export type ViewerSummary = z.infer<typeof viewerSchema>;

/** Body of POST /api/viewer/role. */
export const previewRoleInputSchema = z.strictObject({ role: roleSchema });
export type PreviewRoleInput = z.infer<typeof previewRoleInputSchema>;
