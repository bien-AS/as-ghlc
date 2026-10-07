import { refusal } from "@/lib/api/respond";
import { getViewerSummary } from "@/lib/data/viewer";

export async function GET() {
  try {
    return Response.json(await getViewerSummary());
  } catch (error) {
    return refusal(error);
  }
}
