import type { Workspace } from "@/lib/workspace/schemas";

/*
 * The sample Workspace (spec 12 names the customer and its domain). Imported
 * only by src/lib/data/workspace.ts and its tests; deleted when real data
 * arrives (ADR-0006).
 */
export const buildSampleWorkspace = (): Workspace => ({
  id: "workspace-sample",
  name: "Authority Solutions",
  branding: { displayName: "Authority Solutions", logoInitials: "AS" },
  allowedDomains: ["authoritysolutions.com"],
});
