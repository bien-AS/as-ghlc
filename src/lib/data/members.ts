import {
  buildSampleMembers,
  type MemberRecord,
} from "@/lib/data/fixtures/members";
import { sampleStore } from "@/lib/data/sample";
import { AccessError } from "@/lib/data/users";
import { requireCapability, type Viewer } from "@/lib/data/viewer";
import { inviteExpiresAt, memberLock } from "@/lib/members/rules";
import {
  INVITING_IS_OFFERED,
  type InviteInput,
  type Member,
} from "@/lib/members/schemas";
import type { Role } from "@/lib/roles";
import { sendInviteEmail } from "@/lib/services/invite-email";

/*
 * Data access for who has access to the Workspace (spec 12; ADR-0006).
 *
 * THE SEAM. Every exported function starts with the guard
 * (`requireCapability("manage_users")`: the current user, then their role, so
 * a Staff caller is refused with "forbidden") and then reads or changes the
 * sample store. Going live means replacing the bodies of the exported
 * functions below with queries on User and on wherever invites come to live,
 * replacing the body of `sendInviteEmail`, and deleting the fixtures. Schemas,
 * Route Handlers, query options, hooks and components do not change.
 *
 * This is the only module, with its tests, that imports the fixtures.
 */

const records = sampleStore<MemberRecord[]>("members", () =>
  buildSampleMembers(Date.now()),
);

/**
 * Question 9 (ASSUMED): one shared app, and a User belongs to exactly one
 * Workspace. So the people of "the Workspace" are one list with no Workspace
 * key, removing someone leaves them with no Workspace at all, and an address
 * that already has access cannot be invited again. The other answer changes
 * this function (a membership per Workspace) and the conflict in `inviteMember`.
 */
function workspaceRecords(): MemberRecord[] {
  return records();
}

/**
 * The viewer first, then users, then pending invites. The signed-in person is
 * in no sample list, so their row is built from the session, with the role
 * being previewed. Built field by field: the CRM user id stays behind.
 */
function toList(viewer: Viewer): Member[] {
  const { user } = viewer;
  const you: Member = {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: viewer.role,
    status: "active",
    isViewer: true,
    invitedAt: null,
  };
  const others = workspaceRecords().map(
    ({ id, name, email, role, status, invitedAt }): Member => ({
      id,
      name,
      email,
      role,
      status,
      isViewer: false,
      invitedAt,
    }),
  );
  return [
    you,
    ...others.filter((member) => member.status === "active"),
    ...others.filter((member) => member.status === "invited"),
  ];
}

/** The stored row for an id, of the kind the write is for; else "not_found". */
function find(id: string, status?: Member["status"]): MemberRecord {
  const record = workspaceRecords().find((candidate) => candidate.id === id);
  if (!record || (status && record.status !== status)) {
    throw new AccessError("not_found");
  }
  return record;
}

/**
 * Refuses a change to yourself (your own row is not in the store: your role
 * follows the preview) and to the last owner (spec 12). `keepsOwner` is a
 * change that leaves the last owner an owner, which there is no reason to refuse.
 */
function refuseIfLocked(viewer: Viewer, id: string, keepsOwner = false) {
  const members = toList(viewer);
  const member = members.find((candidate) => candidate.id === id);
  const lock = member ? memberLock(members, member) : null;
  if (lock === "self" || (lock === "last_owner" && !keepsOwner)) {
    throw new AccessError("conflict");
  }
}

function drop(record: MemberRecord) {
  const all = workspaceRecords();
  all.splice(all.indexOf(record), 1);
}

async function send(record: MemberRecord) {
  const sentAt = new Date().toISOString();
  await sendInviteEmail({
    email: record.email,
    expiresAt: inviteExpiresAt(sentAt),
  });
  record.invitedAt = sentAt;
}

// --- the functions whose bodies change when real data arrives ------------------

/** Everyone with access to the Workspace, and every pending invite. */
export async function listMembers(): Promise<Member[]> {
  const viewer = await requireCapability("manage_users");
  return toList(viewer);
}

/**
 * Invites an address with a role. An address that already has access, or
 * already has an invite, is a "conflict".
 */
export async function inviteMember(input: InviteInput): Promise<Member[]> {
  const viewer = await requireCapability("manage_users");
  if (!INVITING_IS_OFFERED) throw new AccessError("forbidden");

  const email = input.email.toLowerCase();
  const taken = toList(viewer).some(
    (member) => member.email.toLowerCase() === email,
  );
  if (taken) throw new AccessError("conflict");

  const record: MemberRecord = {
    id: `invite-${crypto.randomUUID()}`,
    name: null,
    email,
    role: input.role,
    status: "invited",
    invitedAt: null,
    externalCrmUserId: null,
  };
  await send(record);
  workspaceRecords().push(record);
  return toList(viewer);
}

/** Changes a user's role, or the role an invite will give. */
export async function changeMemberRole(
  id: string,
  role: Role,
): Promise<Member[]> {
  const viewer = await requireCapability("manage_users");
  refuseIfLocked(viewer, id, role === "owner");
  find(id).role = role;
  return toList(viewer);
}

/** Removes a user from the Workspace: they lose access at once. */
export async function removeMember(id: string): Promise<Member[]> {
  const viewer = await requireCapability("manage_users");
  refuseIfLocked(viewer, id);
  drop(find(id, "active"));
  return toList(viewer);
}

/** Withdraws a pending invite: its link stops working. */
export async function revokeInvite(id: string): Promise<Member[]> {
  const viewer = await requireCapability("manage_users");
  drop(find(id, "invited"));
  return toList(viewer);
}

/** Sends a pending invite again, which also restarts its expiry. */
export async function resendInvite(id: string): Promise<Member[]> {
  const viewer = await requireCapability("manage_users");
  await send(find(id, "invited"));
  return toList(viewer);
}
