import { invalidInput, refusal } from "@/lib/api/respond";
import { switchTemplate } from "@/lib/data/decks";
import { requireUser } from "@/lib/data/users";
import { switchTemplateInputSchema } from "@/lib/decks/schemas";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/decks/[leadId]/template">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireUser();

    const parsed = switchTemplateInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(
      await switchTemplate((await params).leadId, parsed.data),
    );
  } catch (error) {
    return refusal(error);
  }
}
