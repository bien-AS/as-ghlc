import { invalidInput, refusal } from "@/lib/api/respond";
import { requireUser } from "@/lib/data/users";
import { setPreviewRole } from "@/lib/data/viewer";
import { previewRoleInputSchema } from "@/lib/roles";

/** Preview only (spec 12, question 7): which role the sample dashboard shows. */
export async function POST(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireUser();

    const parsed = previewRoleInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await setPreviewRole(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
