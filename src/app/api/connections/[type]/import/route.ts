import { invalidInput, refusal } from "@/lib/api/respond";
import { crmParamsSchema } from "@/lib/connections/schemas";
import { importLeads } from "@/lib/data/connections";
import { requireCapability } from "@/lib/data/viewer";

/** Import leads from the CRM and report the counts. */
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/connections/[type]/import">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireCapability("manage_connections");

    const route = crmParamsSchema.safeParse(await params);
    if (!route.success) return invalidInput(route.error);

    return Response.json(await importLeads());
  } catch (error) {
    return refusal(error);
  }
}
