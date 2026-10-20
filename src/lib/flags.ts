/*
 * Phase flags (spec 01, section 3): which registry screens are live. A link,
 * tile or sidebar entry whose destination is not live is not rendered, so a
 * screen never links to a route that would 404 in a demo. Keys are registry
 * ids (`screen-registry.json`); a screen not listed here is not live.
 * Client-safe: no server-only imports.
 */

const SCREENS: Record<string, "live" | "mockup"> = {
  // A placeholder until spec 07 builds it; where sign-in lands.
  dashboard: "live",
  // Reads the real ghl_sync_log and webhook_events rows (spec 06).
  "sync-log": "live",
  // Mockups on sample data until each screen's own session replaces them.
  "lead-list": "mockup",
  "lead-detail": "mockup",
  "suspect-review-queue": "mockup",
  "deck-detail": "mockup",
  "proposal-detail": "mockup",
  "notifications-center": "mockup",
  "profile-settings": "mockup",
  "team-reps": "mockup",
  "admin-integrations": "mockup",
};

/** W2, the deck link written to GHL (spec 06): built, off until Phase 4. */
export const ghlDeckLinkWrite = false;

/** Registry ids with an entry here, for the test that checks them against the registry. */
export const FLAGGED_SCREENS = Object.keys(SCREENS);

/** Whether links to this registry screen may be rendered. A mockup is live only outside production. */
export function isLive(screen: string): boolean {
  const state = SCREENS[screen];
  if (state === "mockup") return process.env.NODE_ENV !== "production";
  return state === "live";
}
