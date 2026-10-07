import { invalidInput, refusal } from "@/lib/api/respond";
import { simulateProposalEvent } from "@/lib/data/proposals";
import { requireUser } from "@/lib/data/users";
import { simulateInputSchema } from "@/lib/proposals/schemas";

/**
 * Sample data only (spec 14, question 6): says the lead viewed or signed the
 * proposal. The data-access function answers 403 once the data is real.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/proposals/[leadId]/simulate">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireUser();

    const parsed = simulateInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(
      await simulateProposalEvent((await params).leadId, parsed.data.event),
    );
  } catch (error) {
    return refusal(error);
  }
}
