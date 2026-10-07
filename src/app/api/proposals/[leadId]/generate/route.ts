import { invalidInput, refusal } from "@/lib/api/respond";
import { generateProposal } from "@/lib/data/proposals";
import { requireUser } from "@/lib/data/users";
import { emptyInputSchema } from "@/lib/proposals/schemas";

/** Mock generate: starts a draft for the lead. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/proposals/[leadId]/generate">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireUser();

    const parsed = emptyInputSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await generateProposal((await params).leadId));
  } catch (error) {
    return refusal(error);
  }
}
