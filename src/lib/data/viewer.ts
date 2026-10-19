import { SAMPLE_DATA } from "@/lib/data/sample";
import { requireProfile } from "@/lib/data/users";
import type { ViewerSummary } from "@/lib/roles";

/*
 * Who is asking, for the screens: GET /api/viewer and the shell's prefetch.
 * The role is `profiles.role` (spec 01), read by `requireProfile`. Access is
 * never decided here; the guards in src/lib/data/users.ts decide it.
 */
export async function getViewerSummary(): Promise<ViewerSummary> {
  const { role } = await requireProfile();
  // Drives the sample-data-only controls (the proposal signature simulator).
  return { role, preview: SAMPLE_DATA };
}
