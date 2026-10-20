import { z } from "zod";

import { invalidInput, refusal } from "@/lib/api/respond";
import { requestGhlImport } from "@/lib/data/ghl";
import { requireAdmin } from "@/lib/data/users";

/** The import takes no options: the body is `{}`. */
const importRequestSchema = z.strictObject({});

/** Starts the GHL import (spec 06). 202: it runs in the background. */
export async function POST(request: Request) {
  try {
    // Guard first (AGENTS.md): who is asking is settled before the input is read.
    await requireAdmin();

    const input = importRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) return invalidInput(input.error);

    return Response.json(await requestGhlImport(), { status: 202 });
  } catch (error) {
    return refusal(error);
  }
}
