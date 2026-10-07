import { refusal } from "@/lib/api/respond";
import { listConnections } from "@/lib/data/connections";

export async function GET() {
  try {
    return Response.json(await listConnections());
  } catch (error) {
    return refusal(error);
  }
}
