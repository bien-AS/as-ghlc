import { refusal } from "@/lib/api/respond";
import { listStatusDefs } from "@/lib/data/status-defs";

export async function GET() {
  try {
    return Response.json(await listStatusDefs());
  } catch (error) {
    return refusal(error);
  }
}
