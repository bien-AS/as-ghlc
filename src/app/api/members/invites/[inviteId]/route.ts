import { refusal } from "@/lib/api/respond";
import { revokeInvite } from "@/lib/data/members";

/** Withdraws a pending invite. */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/members/invites/[inviteId]">,
) {
  try {
    return Response.json(await revokeInvite((await params).inviteId));
  } catch (error) {
    return refusal(error);
  }
}
