import { invalidInput, refusal } from "@/lib/api/respond";
import { listNotifications } from "@/lib/data/notifications";
import { requireUser } from "@/lib/data/users";
import { listNotificationsQuerySchema } from "@/lib/notifications/schemas";

export async function GET(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireUser();
    const parsed = listNotificationsQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    return Response.json(await listNotifications(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
