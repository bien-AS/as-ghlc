import { invalidInput, refusal } from "@/lib/api/respond";
import { requireCapability } from "@/lib/data/viewer";
import { getWorkspace, updateWorkspace } from "@/lib/data/workspace";
import { updateWorkspaceSchema } from "@/lib/workspace/schemas";

export async function GET() {
  try {
    return Response.json(await getWorkspace());
  } catch (error) {
    return refusal(error);
  }
}

export async function PUT(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireCapability("manage_workspace");

    const parsed = updateWorkspaceSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await updateWorkspace(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
