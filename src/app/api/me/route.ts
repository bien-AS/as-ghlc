import { refusal } from "@/lib/api/respond";
import { getMe } from "@/lib/data/users";

export async function GET() {
  try {
    return Response.json(await getMe());
  } catch (error) {
    return refusal(error);
  }
}
