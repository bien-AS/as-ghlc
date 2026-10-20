import { invalidInput, refusal } from "@/lib/api/respond";
import { changeStatus } from "@/lib/data/leads";
import { requireProfile } from "@/lib/data/users";
import { statusInputSchema } from "@/lib/leads/schemas";

/** Change status (spec 07): app only, admins until open question 2 is answered. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/status">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireProfile();

    const parsed = statusInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(
      await changeStatus((await params).leadId, parsed.data),
    );
  } catch (error) {
    return refusal(error);
  }
}
