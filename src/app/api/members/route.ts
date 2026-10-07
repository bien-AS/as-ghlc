import { refusal } from "@/lib/api/respond";
import { listMembers } from "@/lib/data/members";

export async function GET() {
  try {
    return Response.json(await listMembers());
  } catch (error) {
    return refusal(error);
  }
}
