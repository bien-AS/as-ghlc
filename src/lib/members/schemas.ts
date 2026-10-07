import { z } from "zod";

import { roleSchema } from "@/lib/roles";

/*
 * The contract for who has access to a Workspace (spec 12, "Users and roles
 * screen"), shaped after the User entity in spec 09, whose field list is
 * assumed. A "member" is a User's place in a Workspace, or an invite to take
 * one; screen copy says people, user, role and Workspace. Client-safe: no
 * server-only imports and no fixtures. The external CRM user id is not here
 * and never reaches the browser.
 *
 * The three roles and what each sees (question 7, PROPOSED) live in
 * `src/lib/roles.ts` and are not repeated here.
 */

/**
 * Spec 12 follows the handoff, which lists "Invite, change role, remove"; the
 * architecture review lists only "Change a role, remove access". MOCK CHOICE:
 * inviting is offered to admins and owners. False hides the form and makes
 * the data-access layer refuse an invite.
 */
export const INVITING_IS_OFFERED = true;

/**
 * Spec 12: invites are single-use, expire and are tied to an email address,
 * and "their storage is to be designed" (the data model has no invite
 * entity). MOCK CHOICE: an invite is a row in the sample store, and it
 * expires this many days after it was last sent.
 */
export const INVITE_EXPIRES_AFTER_DAYS = 7;

export const MEMBER_STATUSES = ["active", "invited"] as const;
export const memberStatusSchema = z.enum(MEMBER_STATUSES);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

export const memberSchema = z.object({
  id: z.string(),
  /** Null for an invite: the person has not joined yet. */
  name: z.string().nullable(),
  email: z.string(),
  role: roleSchema,
  status: memberStatusSchema,
  /** True on the row for the person asking. */
  isViewer: z.boolean(),
  /** When the invite was last sent. Null for a user. */
  invitedAt: z.iso.datetime().nullable(),
});
export type Member = z.infer<typeof memberSchema>;

/** What every members route returns: everyone with access, after the change. */
export const memberListSchema = z.array(memberSchema);

/** Body of POST /api/members/invites, and the invite form's fields. */
export const inviteInputSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter an email address.")
    .pipe(z.email("Enter a valid email address, like name@example.com.")),
  role: roleSchema,
});
export type InviteInput = z.infer<typeof inviteInputSchema>;

/** Body of PATCH /api/members/[memberId]. */
export const changeRoleInputSchema = z.strictObject({ role: roleSchema });
export type ChangeRoleInput = z.infer<typeof changeRoleInputSchema>;
