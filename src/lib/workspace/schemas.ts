import { z } from "zod";

/*
 * The Workspace contract, shaped after spec 09's Workspace row (name, allowed
 * email domains, branding), whose field list is assumed. Shared by Route
 * Handlers, hooks, pages and the data-access layer (ADR-0003). Client-safe: no
 * server-only imports, no fixtures.
 */

const name = z
  .string()
  .trim()
  .min(1, "Enter the Workspace's name.")
  .max(100, "Use 100 characters or fewer for the name.");

const displayName = z
  .string()
  .trim()
  .min(1, "Enter a display name.")
  .max(60, "Use 60 characters or fewer for the display name.");

const logoInitials = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{1,3}$/, "Use 1 to 3 letters or numbers.");

/** An email domain such as "example.com": lower case, labels joined by dots. */
const domain = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter a domain, like example.com.")
  .max(253, "Enter a domain, like example.com.")
  .regex(
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
    "Enter a domain, like example.com, without @ or https://.",
  );

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  /**
   * A display name and logo initials only. Per-Workspace branding of the
   * interface is out of scope (spec 09), so this does not re-theme the app.
   */
  branding: z.object({ displayName: z.string(), logoInitials: z.string() }),
  /** Lower case, in the order they were added. */
  allowedDomains: z.array(z.string()),
});
export type Workspace = z.infer<typeof workspaceSchema>;

/** Body of PUT /api/workspace: the name and the branding, flat as the form sends them. */
export const updateWorkspaceSchema = z.strictObject({
  name,
  displayName,
  logoInitials,
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

/** Body of POST /api/workspace/domains, and the param of DELETE /api/workspace/domains/[domain]. */
export const domainInputSchema = z.strictObject({ domain });
export type DomainInput = z.infer<typeof domainInputSchema>;
