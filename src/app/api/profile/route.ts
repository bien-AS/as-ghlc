import { z } from "zod";

import { apiError, refusal } from "@/lib/api/respond";
import { profileSchema } from "@/lib/auth/schemas";
import { createProfile, requireSession } from "@/lib/data/users";

export async function POST(request: Request) {
  try {
    // Guard first (AGENTS.md): a signed-out request gets 401 whatever it sent.
    await requireSession();

    const body: unknown = await request.json().catch(() => null);
    // Strict: an id, an email or any other extra field is rejected, not ignored.
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "invalid_input",
        400,
        z.flattenError(parsed.error).fieldErrors,
      );
    }

    return Response.json(await createProfile(parsed.data), { status: 201 });
  } catch (error) {
    return refusal(error);
  }
}
