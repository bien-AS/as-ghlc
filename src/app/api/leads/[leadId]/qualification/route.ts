import { invalidInput, refusal } from "@/lib/api/respond";
import { setQualification } from "@/lib/data/leads";
import { requireUser } from "@/lib/data/users";
import { qualificationInputSchema } from "@/lib/leads/schemas";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/qualification">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read,
    // so a signed-out request gets 401 whatever it sent.
    await requireUser();

    const parsed = qualificationInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(
      await setQualification((await params).leadId, parsed.data),
    );
  } catch (error) {
    return refusal(error);
  }
}
