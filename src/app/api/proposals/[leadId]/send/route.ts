import { invalidInput, refusal } from "@/lib/api/respond";
import { sendProposal } from "@/lib/data/proposals";
import { requireUser } from "@/lib/data/users";
import { emptyInputSchema } from "@/lib/proposals/schemas";

/** Sends the draft to the lead. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/proposals/[leadId]/send">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireUser();

    const parsed = emptyInputSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await sendProposal((await params).leadId));
  } catch (error) {
    return refusal(error);
  }
}
