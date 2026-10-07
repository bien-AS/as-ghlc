import { refusal } from "@/lib/api/respond";
import { getDeckPdf } from "@/lib/data/decks";

/** The deck as a download. Guarded like every other route; a refusal is JSON. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/decks/[leadId]/pdf">,
) {
  try {
    const { filename, bytes } = await getDeckPdf((await params).leadId);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return refusal(error);
  }
}
