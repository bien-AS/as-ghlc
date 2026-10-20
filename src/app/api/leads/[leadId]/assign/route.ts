import { invalidInput, refusal } from "@/lib/api/respond";
import { assignRep } from "@/lib/data/leads";
import { requireAdmin } from "@/lib/data/users";
import { assignInputSchema } from "@/lib/leads/schemas";

/** Assign rep (spec 07): admins only, app only. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/assign">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireAdmin();

    const parsed = assignInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await assignRep((await params).leadId, parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
