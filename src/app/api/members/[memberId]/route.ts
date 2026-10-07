import { invalidInput, refusal } from "@/lib/api/respond";
import { changeMemberRole, removeMember } from "@/lib/data/members";
import { requireCapability } from "@/lib/data/viewer";
import { changeRoleInputSchema } from "@/lib/members/schemas";

/** Changes a user's role, or the role a pending invite will give. */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/members/[memberId]">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireCapability("manage_users");

    const parsed = changeRoleInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(
      await changeMemberRole((await params).memberId, parsed.data.role),
    );
  } catch (error) {
    return refusal(error);
  }
}

/** Removes a user from the Workspace. */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/members/[memberId]">,
) {
  try {
    return Response.json(await removeMember((await params).memberId));
  } catch (error) {
    return refusal(error);
  }
}
