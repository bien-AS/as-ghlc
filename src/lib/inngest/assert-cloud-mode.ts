/**
 * Refuse to serve /api/inngest in dev mode on a deployed environment.
 *
 * In dev mode the Inngest SDK skips request signature validation entirely, so
 * INNGEST_DEV on a deployment would leave /api/inngest unauthenticated. The SDK's
 * own "no signing key" error suggests setting INNGEST_DEV=1, which is exactly the
 * wrong fix on a deployment; this turns it into a loud failure instead. Called at
 * module scope by the route, so `next build` fails while collecting page data.
 *
 * VERCEL_ENV rather than NODE_ENV: Vercel sets it on every deployment, previews
 * included, and it is absent under `next dev`. Any non-empty INNGEST_DEV trips it,
 * deliberately: the SDK treats values outside 0/1/true/false as a dev server URL,
 * so matching its parser here would be a check that silently drifts.
 *
 * @param env injectable for tests; production reads process.env.
 */
export function assertCloudModeOnDeployment(
  env: Record<string, string | undefined> = process.env,
): void {
  if (!env.VERCEL_ENV || !env.INNGEST_DEV) return;
  throw new Error(
    `INNGEST_DEV is set on a deployed environment (VERCEL_ENV=${env.VERCEL_ENV}). ` +
      "Dev mode disables request signing on /api/inngest. " +
      "Unset INNGEST_DEV and set INNGEST_SIGNING_KEY.",
  );
}
