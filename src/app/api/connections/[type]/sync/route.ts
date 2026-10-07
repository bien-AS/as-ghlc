import { invalidInput, refusal } from "@/lib/api/respond";
import { crmParamsSchema } from "@/lib/connections/schemas";
import { syncNow } from "@/lib/data/connections";
import { requireCapability } from "@/lib/data/viewer";

/** Sync now. Only the CRM Connection syncs. */
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/connections/[type]/sync">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireCapability("manage_connections");

    const route = crmParamsSchema.safeParse(await params);
    if (!route.success) return invalidInput(route.error);

    return Response.json(await syncNow(route.data.type));
  } catch (error) {
    return refusal(error);
  }
}
