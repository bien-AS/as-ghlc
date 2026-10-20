import { and, desc, eq, isNotNull, like } from "drizzle-orm";

import { db } from "@/db/client";
import { leadResearch } from "@/db/schema";
import { getLead } from "@/lib/data/leads";
import { requireProfile } from "@/lib/data/users";
import { inngest } from "@/lib/inngest/client";
import { LEAD_RESEARCH_REQUESTED } from "@/lib/inngest/functions/research";
import {
  type LeadResearch,
  type ResearchBrief,
  researchFactsSchema,
} from "@/lib/research/schemas";

/*
 * Data access for a lead's research brief (spec 07). A brief belongs to its
 * lead, so every function here reaches it through `getLead`, which is the
 * guard: `requireProfile` then the lead's `leadScope` (a rep's request for
 * another rep's lead is not_found, before anything is read or sent). The work
 * itself runs in the Inngest job (lib/inngest/functions/research.ts).
 */

/** Recent priced runs the estimate averages over. */
const ESTIMATE_SAMPLE = 20;

const toBrief = (row: typeof leadResearch.$inferSelect): ResearchBrief => ({
  id: row.id,
  briefMd: row.briefMd ?? "",
  facts: researchFactsSchema.parse(row.facts),
  model: row.model,
  inputTokens: row.inputTokens,
  outputTokens: row.outputTokens,
  costUsd: row.costUsd === null ? null : Number(row.costUsd),
  createdAt: row.createdAt.toISOString(),
});

/**
 * The cost line shown before a refresh: the average cost of the default
 * model's recent priced runs, or "Not measured" when there are none.
 */
export async function estimateResearchCost(): Promise<string> {
  await requireProfile();
  const model = process.env.OPENROUTER_MODEL;
  if (!model) return "Not measured";
  // OpenRouter may answer with a dated variant of the model asked for.
  const rows = await db
    .select({ cost: leadResearch.costUsd })
    .from(leadResearch)
    .where(
      and(
        eq(leadResearch.status, "ready"),
        isNotNull(leadResearch.costUsd),
        like(leadResearch.model, `${model}%`),
      ),
    )
    .orderBy(desc(leadResearch.createdAt))
    .limit(ESTIMATE_SAMPLE);
  if (!rows.length) return "Not measured";
  const average =
    rows.reduce((sum, row) => sum + Number(row.cost), 0) / rows.length;
  return average < 0.005
    ? "< $0.01 per run"
    : `≈ $${average.toFixed(2)} per run`;
}

/** The latest ready brief, the newest run if it is still generating or failed, and the cost line. */
export async function getLatestResearch(leadId: string): Promise<LeadResearch> {
  await getLead(leadId);
  const latest = (where = eq(leadResearch.leadId, leadId)) =>
    db.query.leadResearch.findFirst({
      where,
      orderBy: desc(leadResearch.createdAt),
    });
  const [newest, ready, costEstimate] = await Promise.all([
    latest(),
    latest(
      and(eq(leadResearch.leadId, leadId), eq(leadResearch.status, "ready")),
    ),
    estimateResearchCost(),
  ]);
  return {
    brief: ready ? toBrief(ready) : null,
    run:
      newest && newest.status !== "ready"
        ? {
            status: newest.status,
            error: newest.error,
            createdAt: newest.createdAt.toISOString(),
          }
        : null,
    costEstimate,
  };
}

/**
 * Asks for a fresh brief. Repeats within the same minute are one run: the
 * event id dedupes them in Inngest (and the job runs one at a time per lead).
 */
export async function requestResearch(
  leadId: string,
): Promise<{ eventId: string }> {
  await getLead(leadId);
  const minute = Math.floor(Date.now() / 60_000);
  const { ids } = await inngest.send({
    id: `research-${leadId}-${minute}`,
    name: LEAD_RESEARCH_REQUESTED,
    data: { leadId },
  });
  return { eventId: ids[0] };
}
