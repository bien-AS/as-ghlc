import { invalidInput, refusal } from "@/lib/api/respond";
import { requireCapability } from "@/lib/data/viewer";
import { addAllowedDomain } from "@/lib/data/workspace";
import { domainInputSchema } from "@/lib/workspace/schemas";

export async function POST(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireCapability("manage_workspace");

    const parsed = domainInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await addAllowedDomain(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
