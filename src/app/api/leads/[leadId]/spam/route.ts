import { invalidInput, refusal } from "@/lib/api/respond";
import { markSpam } from "@/lib/data/leads";
import { requireUser } from "@/lib/data/users";
import { spamInputSchema } from "@/lib/leads/schemas";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/spam">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read,
    // so a signed-out request gets 401 whatever it sent.
    await requireUser();

    const parsed = spamInputSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await markSpam((await params).leadId));
  } catch (error) {
    return refusal(error);
  }
}
