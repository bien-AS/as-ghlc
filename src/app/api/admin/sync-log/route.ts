import { invalidInput, refusal } from "@/lib/api/respond";
import { listSyncLog } from "@/lib/data/sync-log";
import { requireAdmin } from "@/lib/data/users";
import { listSyncLogQuerySchema } from "@/lib/sync-log/schemas";

/** The sync log, newest first (spec 06). Admin only. */
export async function GET(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireAdmin();

    const parsed = listSyncLogQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await listSyncLog(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
