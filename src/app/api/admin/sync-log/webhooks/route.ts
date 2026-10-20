import { invalidInput, refusal } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/data/users";
import { listWebhookEvents } from "@/lib/data/webhook-events";
import { listWebhookEventsQuerySchema } from "@/lib/sync-log/schemas";

/** Webhooks received, newest first, with their outcome (spec 06). Admin only. */
export async function GET(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireAdmin();

    const parsed = listWebhookEventsQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await listWebhookEvents(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
