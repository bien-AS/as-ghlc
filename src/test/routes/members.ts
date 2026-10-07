import {
  DELETE as deleteMember,
  PATCH as patchMember,
} from "@/app/api/members/[memberId]/route";
import { POST as postResend } from "@/app/api/members/invites/[inviteId]/resend/route";
import { DELETE as deleteInvite } from "@/app/api/members/invites/[inviteId]/route";
import { POST as postInvite } from "@/app/api/members/invites/route";
import { GET as getMembers } from "@/app/api/members/route";
import type { TestRoute } from "@/test/dashboard";

export const routes: TestRoute[] = [
  ["GET", /^\/api\/members$/, getMembers],
  ["POST", /^\/api\/members\/invites$/, postInvite],
  ["POST", /^\/api\/members\/invites\/(?<inviteId>[^/]+)\/resend$/, postResend],
  ["DELETE", /^\/api\/members\/invites\/(?<inviteId>[^/]+)$/, deleteInvite],
  ["PATCH", /^\/api\/members\/(?<memberId>[^/]+)$/, patchMember],
  ["DELETE", /^\/api\/members\/(?<memberId>[^/]+)$/, deleteMember],
];
