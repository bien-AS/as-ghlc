/*
 * The email service that would deliver an invite (spec 12). Server only, and
 * called only by `src/lib/data/members.ts`. Today nothing is sent: this is the
 * one place the real client goes.
 */

/** Sends, or sends again, the invite to join the Workspace. Sample data: a no-op. */
export async function sendInviteEmail(_invite: {
  email: string;
  expiresAt: string;
}): Promise<void> {}
