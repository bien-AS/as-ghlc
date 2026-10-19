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
export type MemberLock = "self";

/**
 * Nobody removes themselves or changes their own role on this screen. Only
 * an admin reaches it, so an admin always remains: no "last admin" rule.
 */
export function memberLock(member: Member): MemberLock | null {
  return member.isViewer ? "self" : null;
}

export const MEMBER_LOCK_REASON: Record<MemberLock, string> = {
  self: "This is you. You cannot change your own role.",
};

/** When an invite stops working (MOCK CHOICE, see INVITE_EXPIRES_AFTER_DAYS). */
export const inviteExpiresAt = (invitedAt: string) =>
  new Date(
    new Date(invitedAt).getTime() + INVITE_EXPIRES_AFTER_DAYS * 86_400_000,
  ).toISOString();
