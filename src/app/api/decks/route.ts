import { refusal } from "@/lib/api/respond";
import { listDecks } from "@/lib/data/decks";

export async function GET() {
  try {
    return Response.json(await listDecks());
  } catch (error) {
    return refusal(error);
  }
}
