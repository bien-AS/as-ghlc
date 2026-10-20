import { invalidInput, refusal } from "@/lib/api/respond";
import { retryWrite } from "@/lib/data/sync-log";
import { requireAdmin } from "@/lib/data/users";
import { retryInputSchema, syncLogIdSchema } from "@/lib/sync-log/schemas";

/** "Retry" on a sync log entry: re-runs the write through the same runner. Admin only. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/admin/sync-log/[id]/retry">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireAdmin();

    const id = syncLogIdSchema.safeParse((await params).id);
    if (!id.success) return invalidInput(id.error);
    const body = retryInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!body.success) return invalidInput(body.error);

    return Response.json(await retryWrite(id.data));
  } catch (error) {
    return refusal(error);
  }
}
