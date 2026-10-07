import type { Member } from "@/lib/members/schemas";

/*
 * Sample people for the Users and roles screen (spec 12; ADR-0006). Imported
 * by the data-access layer and its tests only. Everyone is invented and every
 * address uses a reserved example domain.
 *
 * The four Staff are the reps on the sample leads. Lead fixtures belong to the
 * leads module, so the names are repeated here; `members.test.ts` checks them
 * against the Pipeline's rep list.
 */

/** A member as stored. Whether a row is the viewer is decided on read. */
export type MemberRecord = Omit<Member, "isViewer"> & {
  /** Spec 09: never leaves the server. Null for an invite. */
  externalCrmUserId: string | null;
};

const DAY = 86_400_000;

const user = (
  id: string,
  name: string,
  role: Member["role"],
): MemberRecord => ({
  id: `user-${id}`,
  name,
  email: `${name.toLowerCase().replace(" ", ".")}@northgate.example`,
  role,
  status: "active",
  invitedAt: null,
  externalCrmUserId: `crm-user-${id}`,
});

const invite = (
  id: string,
  email: string,
  role: Member["role"],
  sentAt: number,
): MemberRecord => ({
  id: `invite-${id}`,
  name: null,
  email,
  role,
  status: "invited",
  invitedAt: new Date(sentAt).toISOString(),
  externalCrmUserId: null,
});

// ponytail: `now` is fixed when the server instance first reads the store, so
// a server left running for days shows these invites as expired. A restart, or
// "Send again", resets them.
export function buildSampleMembers(now: number): MemberRecord[] {
  return [
    user("helena", "Helena Brandt", "owner"),
    user("samir", "Samir Haddad", "admin"),
    user("maya", "Maya Okafor", "staff"),
    user("daniel", "Daniel Reyes", "staff"),
    user("priya", "Priya Nair", "staff"),
    user("tom", "Tom Lindqvist", "staff"),
    invite("jonas", "jonas.weber@northgate.example", "staff", now - 2 * DAY),
    invite("amira", "amira.soto@fieldhouse.example", "admin", now - 5 * DAY),
  ];
}
