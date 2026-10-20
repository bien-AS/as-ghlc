import { invalidInput, refusal } from "@/lib/api/respond";
import { archiveLead } from "@/lib/data/leads";
import { requireProfile } from "@/lib/data/users";
import { archiveInputSchema } from "@/lib/leads/schemas";

/** Archive (spec 07): a soft delete in the app; nothing is written to GHL. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/archive">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireProfile();

    const parsed = archiveInputSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await archiveLead((await params).leadId, parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
