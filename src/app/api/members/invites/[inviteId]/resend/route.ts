import { refusal } from "@/lib/api/respond";
import { resendInvite } from "@/lib/data/members";

/** Sends a pending invite again. */
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/members/invites/[inviteId]/resend">,
) {
  try {
    return Response.json(await resendInvite((await params).inviteId));
  } catch (error) {
    return refusal(error);
  }
}
