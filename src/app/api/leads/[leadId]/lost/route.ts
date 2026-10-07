import { invalidInput, refusal } from "@/lib/api/respond";
import { markLost } from "@/lib/data/leads";
import { requireUser } from "@/lib/data/users";
import { lostInputSchema } from "@/lib/leads/schemas";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/lost">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read,
    // so a signed-out request gets 401 whatever it sent.
    await requireUser();

    const parsed = lostInputSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await markLost((await params).leadId, parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
