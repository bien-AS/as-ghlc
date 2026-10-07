import { refusal } from "@/lib/api/respond";
import { getDeck } from "@/lib/data/decks";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/decks/[leadId]">,
) {
  try {
    return Response.json(await getDeck((await params).leadId));
  } catch (error) {
    return refusal(error);
  }
}
