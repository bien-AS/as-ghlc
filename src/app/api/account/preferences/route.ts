import { accountPreferencesSchema } from "@/lib/account/schemas";
import { invalidInput, refusal } from "@/lib/api/respond";
import {
  getAccountPreferences,
  updateAccountPreferences,
} from "@/lib/data/account";
import { requireUser } from "@/lib/data/users";

export async function GET() {
  try {
    return Response.json(await getAccountPreferences());
  } catch (error) {
    return refusal(error);
  }
}

export async function PUT(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireUser();
    const parsed = accountPreferencesSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    return Response.json(await updateAccountPreferences(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
