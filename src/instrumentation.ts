/*
 * Runs once when a server instance starts. The GHL startup check (spec 06,
 * acceptance check 1): with GHL_IDS set, every configured id must resolve in
 * the location, or the server refuses to start, naming the ids that do not.
 * Without GHL_IDS the connector is off and the check is skipped with a warning.
 * GHL being unreachable is logged, not fatal: a GHL outage must not take
 * sign-in down with it.
 *
 * ponytail: four GHL reads per cold start; move the check to a deploy step if
 * cold starts show it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.GHL_IDS) {
    console.warn("[ghl] GHL_IDS is not set: the GHL connector is off");
    return;
  }
  const { checkGhlIds, ghlConfig, GhlError } =
    await import("@/lib/services/ghl");
  ghlConfig(); // A malformed GHL_IDS is fatal.
  const missing = await checkGhlIds().catch((error: Error) => {
    if (!(error instanceof GhlError) && error.name !== "TypeError") throw error;
    console.error("[ghl] startup check could not reach GHL:", error.message);
    return [];
  });
  if (missing.length) {
    throw new Error(`GHL_IDS: not found in location: ${missing.join(", ")}`);
  }
}
