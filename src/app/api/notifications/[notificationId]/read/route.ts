import { refusal } from "@/lib/api/respond";
import { markNotificationRead } from "@/lib/data/notifications";

/** Takes no body: the id in the address is the whole input. */
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/notifications/[notificationId]/read">,
) {
  try {
    return Response.json(
      await markNotificationRead((await params).notificationId),
    );
  } catch (error) {
    return refusal(error);
  }
}
