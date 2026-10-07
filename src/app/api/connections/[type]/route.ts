import { invalidInput, refusal } from "@/lib/api/respond";
import {
  connectInputSchema,
  connectionParamsSchema,
} from "@/lib/connections/schemas";
import { connect, disconnect } from "@/lib/data/connections";
import { requireCapability } from "@/lib/data/viewer";

/** Connect. The key in the body is never stored, logged or returned. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/connections/[type]">,
) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireCapability("manage_connections");

    const route = connectionParamsSchema.safeParse(await params);
    if (!route.success) return invalidInput(route.error);
    const parsed = connectInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await connect(route.data.type, parsed.data));
  } catch (error) {
    return refusal(error);
  }
}

/** Disconnect. */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/connections/[type]">,
) {
  try {
    await requireCapability("manage_connections");

    const route = connectionParamsSchema.safeParse(await params);
    if (!route.success) return invalidInput(route.error);

    return Response.json(await disconnect(route.data.type));
  } catch (error) {
    return refusal(error);
  }
}
