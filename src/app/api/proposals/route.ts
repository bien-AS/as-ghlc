import { refusal } from "@/lib/api/respond";
import { listProposalLeads } from "@/lib/data/proposals";

export async function GET() {
  try {
    return Response.json(await listProposalLeads());
  } catch (error) {
    return refusal(error);
  }
}
