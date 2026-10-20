import { refusal } from "@/lib/api/respond";
import { getLatestResearch, requestResearch } from "@/lib/data/research";

/*
 * A lead's research brief (spec 07). The data functions are the guard (the
 * lead's scope); the only input is the path's lead id.
 */

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/research">,
) {
  try {
    return Response.json(await getLatestResearch((await params).leadId));
  } catch (error) {
    return refusal(error);
  }
}

/** "Refresh research": queues a run; the brief arrives when the job finishes. */
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/research">,
) {
  try {
    return Response.json(await requestResearch((await params).leadId), {
      status: 202,
    });
  } catch (error) {
    return refusal(error);
  }
}
