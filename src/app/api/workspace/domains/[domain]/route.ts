import { invalidInput, refusal } from "@/lib/api/respond";
import { requireCapability } from "@/lib/data/viewer";
import { removeAllowedDomain } from "@/lib/data/workspace";
import { domainInputSchema } from "@/lib/workspace/schemas";

export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/workspace/domains/[domain]">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireCapability("manage_workspace");

    const parsed = domainInputSchema.safeParse(await params);
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await removeAllowedDomain(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
