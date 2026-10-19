import { SAMPLE_DATA } from "@/lib/data/sample";
import { requireProfile } from "@/lib/data/users";
import type { ViewerSummary } from "@/lib/roles";

/*
 * Who is asking, for the screens: GET /api/viewer and the shell's prefetch.
 * The role is `profiles.role` (spec 01), read by `requireProfile`. Access is
 * never decided here; the guards in src/lib/data/users.ts decide it.
 *
 * ponytail: the screens still speak the mockups' role names, so an admin is
 * drawn as "admin" and a rep as "staff". The shell (spec 01, S5) moves the
 * screens to `admin` and `rep` and this mapping goes.
 */
export async function getViewerSummary(): Promise<ViewerSummary> {
  const profile = await requireProfile();
  const rep = profile.role === "rep";
  return {
    role: rep ? "staff" : "admin",
    // Drives the sample-data-only controls (the proposal signature simulator).
    preview: SAMPLE_DATA,
    staffRep: rep
      ? { id: profile.id, name: `${profile.firstName} ${profile.lastName}` }
      : null,
  };
}
