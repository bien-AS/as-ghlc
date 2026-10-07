import { invalidInput, refusal } from "@/lib/api/respond";
import { getProposal, saveProposalDraft } from "@/lib/data/proposals";
import { requireUser } from "@/lib/data/users";
import { proposalDraftInputSchema } from "@/lib/proposals/schemas";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/proposals/[leadId]">,
) {
  try {
    return Response.json(await getProposal((await params).leadId));
  } catch (error) {
    return refusal(error);
  }
}

/** Saves the rep's edits to a draft. */
export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/proposals/[leadId]">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireUser();

    const parsed = proposalDraftInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(
      await saveProposalDraft((await params).leadId, parsed.data),
    );
  } catch (error) {
    return refusal(error);
  }
}
