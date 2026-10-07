import { apiError, refusal } from "@/lib/api/respond";
import { createProfileSilently } from "@/lib/data/users";

/**
 * The silent path of profile setup (spec 02). POST only, and it reads no body:
 * the names, id and email all come from the verified session. There is
 * deliberately no GET, so nothing that merely fetches an address (a prefetch,
 * a link scanner, a speculative load) can create a profile.
 *
 * 201 with the User (created, or already there); 409 "profile_form_required"
 * when the form must be shown instead; 401 when signed out.
 */
export async function POST() {
  try {
    const user = await createProfileSilently();
    return user
      ? Response.json(user, { status: 201 })
      : apiError("profile_form_required", 409);
  } catch (error) {
    return refusal(error);
  }
}
