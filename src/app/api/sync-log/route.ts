import { refusal } from "@/lib/api/respond";
import { listSyncLog } from "@/lib/data/sync-log";
import { requireUser } from "@/lib/data/users";

export async function GET() {
  try {
    // Guard first (AGENTS.md); the role check is inside the data function.
    await requireUser();
    return Response.json(await listSyncLog());
  } catch (error) {
    return refusal(error);
  }
}
