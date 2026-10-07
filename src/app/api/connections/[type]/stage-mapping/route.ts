import { invalidInput, refusal } from "@/lib/api/respond";
import {
  crmParamsSchema,
  stageMappingInputSchema,
} from "@/lib/connections/schemas";
import { getStageMapping, saveStageMapping } from "@/lib/data/connections";
import { requireCapability } from "@/lib/data/viewer";

type Context = RouteContext<"/api/connections/[type]/stage-mapping">;

/** The CRM's stage names and the saved mapping. */
export async function GET(_request: Request, { params }: Context) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireCapability("manage_connections");

    const route = crmParamsSchema.safeParse(await params);
    if (!route.success) return invalidInput(route.error);

    return Response.json(await getStageMapping());
  } catch (error) {
    return refusal(error);
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    await requireCapability("manage_connections");

    const route = crmParamsSchema.safeParse(await params);
    if (!route.success) return invalidInput(route.error);
    const parsed = stageMappingInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await saveStageMapping(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
