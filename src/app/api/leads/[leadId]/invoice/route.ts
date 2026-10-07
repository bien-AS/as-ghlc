import { refusal } from "@/lib/api/respond";
import { getInvoice } from "@/lib/data/invoices";

/** The lead's invoice, or null when it has none (spec 15). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/invoice">,
) {
  try {
    return Response.json(await getInvoice((await params).leadId));
  } catch (error) {
    return refusal(error);
  }
}
