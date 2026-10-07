import { invalidInput, refusal } from "@/lib/api/respond";
import { reviewSuspect } from "@/lib/data/leads";
import { requireUser } from "@/lib/data/users";
import { reviewInputSchema } from "@/lib/leads/schemas";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/review">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read,
    // so a signed-out request gets 401 whatever it sent.
    await requireUser();

    const parsed = reviewInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(
      await reviewSuspect((await params).leadId, parsed.data),
    );
  } catch (error) {
    return refusal(error);
  }
}
