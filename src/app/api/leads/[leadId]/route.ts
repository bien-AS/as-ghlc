import { refusal } from "@/lib/api/respond";
import { getLead } from "@/lib/data/leads";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/leads/[leadId]">,
) {
  try {
    return Response.json(await getLead((await params).leadId));
  } catch (error) {
    return refusal(error);
  }
}
