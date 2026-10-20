import { invalidInput, refusal } from "@/lib/api/respond";
import { getDashboard } from "@/lib/data/dashboard";
import { requireProfile } from "@/lib/data/users";
import { dashboardQuerySchema } from "@/lib/leads/schemas";

export async function GET(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireProfile();

    const parsed = dashboardQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await getDashboard(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
