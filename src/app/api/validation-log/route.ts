import { refusal } from "@/lib/api/respond";
import { requireUser } from "@/lib/data/users";
import { listValidationLog } from "@/lib/data/validation-log";

export async function GET() {
  try {
    // Guard first (AGENTS.md); the role check is inside the data function.
    await requireUser();
    return Response.json(await listValidationLog());
  } catch (error) {
    return refusal(error);
  }
}
