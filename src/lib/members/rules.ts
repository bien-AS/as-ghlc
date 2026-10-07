import type { Tone } from "@/lib/leads/rules";
import {
  INVITE_EXPIRES_AFTER_DAYS,
  type Member,
  type MemberStatus,
} from "@/lib/members/schemas";

/*
 * The rules the Users and roles screen and the data-access layer share, so the
 * page and the server cannot disagree (spec 12). Pure functions; no data access.
 */

/** The one status-to-tone mapping. A chip always carries its word. */
export const MEMBER_STATUS_META: Record<
  MemberStatus,
  { label: string; tone: Tone }
> = {
  active: { label: "Active", tone: "ok" },
  invited: { label: "Pending", tone: "warn" },
};

/** Why a person's role cannot be changed, and why they cannot be removed. */
export type MemberLock = "self" | "last_owner";

/**
 * Spec 12, "Last owner": the only owner cannot be removed or demoted. And
 * nobody removes themselves or changes their own role on this screen. An
 * invited owner has not joined, so does not count as an owner yet.
 */
export function memberLock(
  members: readonly Member[],
  member: Member,
): MemberLock | null {
  if (member.isViewer) return "self";
  const owners = members.filter(
    (other) => other.status === "active" && other.role === "owner",
  );
  return owners.length === 1 && owners[0].id === member.id
    ? "last_owner"
    : null;
}

export const MEMBER_LOCK_REASON: Record<MemberLock, string> = {
  // The sample dashboard has no membership: the viewer's role is the preview.
  self: "This is you. Your role follows “Viewing as” while the data is sample data.",
  last_owner:
    "The only owner. Make someone else an owner before changing or removing this one.",
};

/** When an invite stops working (MOCK CHOICE, see INVITE_EXPIRES_AFTER_DAYS). */
export const inviteExpiresAt = (invitedAt: string) =>
  new Date(
    new Date(invitedAt).getTime() + INVITE_EXPIRES_AFTER_DAYS * 86_400_000,
  ).toISOString();
