import { invalidInput, refusal } from "@/lib/api/respond";
import { listLeads } from "@/lib/data/leads";
import { requireUser } from "@/lib/data/users";
import { listLeadsQuerySchema } from "@/lib/leads/schemas";

export async function GET(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read,
    // so a signed-out request gets 401 whatever it sent.
    await requireUser();

    const parsed = listLeadsQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    return Response.json(await listLeads(parsed.data));
  } catch (error) {
    return refusal(error);
  }
}
