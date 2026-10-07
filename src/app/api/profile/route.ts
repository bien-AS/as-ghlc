import { z } from "zod";

import { apiError, invalidInput, refusal } from "@/lib/api/respond";
import { profileSchema } from "@/lib/auth/schemas";
import {
  createProfile,
  requireSession,
  requireUser,
  updateProfile,
} from "@/lib/data/users";

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

/** Changes the signed-in person's own name (Account settings). */
export async function PATCH(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireUser();
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
