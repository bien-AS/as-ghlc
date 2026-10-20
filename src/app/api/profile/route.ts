import { invalidInput, refusal } from "@/lib/api/respond";
import { profileSchema } from "@/lib/auth/schemas";
import { requireProfile, updateProfile } from "@/lib/data/users";

/** Changes the signed-in person's own name (Account settings). */
export async function PATCH(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireProfile();
    // Strict: an id, an email or any other extra field is rejected, not ignored.
    const parsed = profileSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    return Response.json(await updateProfile(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
