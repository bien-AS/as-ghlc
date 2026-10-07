import { refusal } from "@/lib/api/respond";
import { getUnreadCount } from "@/lib/data/notifications";

export async function GET() {
  try {
    return Response.json(await getUnreadCount());
  } catch (error) {
    return refusal(error);
  }
}
