import { invalidInput, refusal } from "@/lib/api/respond";
import { inviteMember } from "@/lib/data/members";
import { requireCapability } from "@/lib/data/viewer";
import { inviteInputSchema } from "@/lib/members/schemas";

export async function POST(request: Request) {
  try {
    // Guard first (AGENTS.md): a caller who may not manage users gets 401 or
    // 403 whatever they sent.
    await requireCapability("manage_users");

    const parsed = inviteInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await inviteMember(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
