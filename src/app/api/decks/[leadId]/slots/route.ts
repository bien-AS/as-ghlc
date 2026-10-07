import { refusal } from "@/lib/api/respond";
import { getBookingSlots } from "@/lib/data/decks";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/decks/[leadId]/slots">,
) {
  try {
    return Response.json(await getBookingSlots((await params).leadId));
  } catch (error) {
    return refusal(error);
  }
}
