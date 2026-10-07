import { invalidInput, refusal } from "@/lib/api/respond";
import { updateSlide } from "@/lib/data/decks";
import { requireUser } from "@/lib/data/users";
import { updateSlideInputSchema } from "@/lib/decks/schemas";

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/decks/[leadId]/slides/[slideId]">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireUser();

    const parsed = updateSlideInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    const { leadId, slideId } = await params;
    return Response.json(await updateSlide(leadId, slideId, parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
