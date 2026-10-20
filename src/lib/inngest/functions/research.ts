import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { leadResearch, leads } from "@/db/schema";
import { inngest } from "@/lib/inngest/client";
import { briefMessages, parseBrief } from "@/lib/research/prompt";
import type { ResearchFacts } from "@/lib/research/schemas";
import { complete } from "@/lib/services/llm";
import { fetchSite } from "@/lib/services/research-fetch";

import { LEAD_VALIDATION_REQUESTED } from "./ghl-sync";

/*
 * The research brief job (spec 07, "Research brief"). Runs on intake (with
 * validation, spec 08) and on "Refresh research". Each run is one lead_research
 * row: 'generating', then 'ready' with the brief, facts and usage, or 'failed'
 * with the error, in which case the previous ready brief stays the one shown
 * (acceptance check 4).
 *
 * Runs as the system, not as a person: whoever asked for a refresh was checked
 * by `requestResearch` (data/research.ts). `db` is the privileged connection
 * (ADR-0007): lead_research is default-deny for every Supabase role.
 */

export const LEAD_RESEARCH_REQUESTED = "lead/research.requested";

/** Both triggers carry the lead id (intake: ghl-sync.ts; refresh: data/research.ts). */
const eventData = z.object({ leadId: z.uuid() });

type Step = {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<unknown>;
};

const NO_WEBSITE: { briefMd: string; facts: ResearchFacts } = {
  briefMd:
    "## No website on file\n\nThis lead gave no website, so there was nothing to research. " +
    "Add one in GHL and refresh the research.",
  facts: {
    summary: "No website on file; nothing was researched.",
    claims: [],
  },
};

/** Opens the run: a 'generating' row. */
async function startRun(leadId: string): Promise<string> {
  const [row] = await db
    .insert(leadResearch)
    .values({ leadId, status: "generating" })
    .returning({ id: leadResearch.id });
  return row.id;
}

/** Fetches the site, asks the model, and makes the row 'ready'. Throws on any failure, so Inngest retries. */
async function writeBrief(runId: string, leadId: string): Promise<void> {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
    columns: { companyName: true, website: true },
  });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const website = lead.website?.trim();
  if (!website) {
    // No model call, so no usage: model, tokens and cost stay null.
    await db
      .update(leadResearch)
      .set({ status: "ready", ...NO_WEBSITE })
      .where(eq(leadResearch.id, runId));
    return;
  }

  const pages = await fetchSite(website);
  const completion = await complete({
    messages: briefMessages({ companyName: lead.companyName, website }, pages),
  });
  const { markdown, ...facts } = parseBrief(completion.text);
  await db
    .update(leadResearch)
    .set({
      status: "ready",
      briefMd: markdown,
      facts,
      model: completion.model,
      inputTokens: completion.promptTokens,
      outputTokens: completion.completionTokens,
      // null when OpenRouter does not report it: not measured, never 0.
      costUsd: completion.cost === null ? null : String(completion.cost),
    })
    .where(eq(leadResearch.id, runId));
}

async function failRun(runId: string, error: unknown): Promise<void> {
  await db
    .update(leadResearch)
    .set({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    })
    .where(eq(leadResearch.id, runId));
}

/** The job body, exported for tests (which pass a step that just runs each body). */
export async function researchHandler({
  event,
  step,
}: {
  event: { data: unknown };
  step: Step;
}) {
  const { leadId } = eventData.parse(event.data);
  const runId = (await step.run("start", () => startRun(leadId))) as string;
  try {
    await step.run("brief", () => writeBrief(runId, leadId));
  } catch (error) {
    // After Inngest's retries: the run is failed, and the last ready brief stays shown.
    await step.run("failed", () => failRun(runId, error));
    return { runId, status: "failed" as const };
  }
  return { runId, status: "ready" as const };
}

export const leadResearchJob = inngest.createFunction(
  {
    id: "lead-research",
    // One run per lead at a time; a refresh during a run waits for it.
    concurrency: { limit: 1, key: "event.data.leadId" },
    triggers: [
      { event: LEAD_RESEARCH_REQUESTED },
      { event: LEAD_VALIDATION_REQUESTED },
    ],
  },
  ({ event, step }) => researchHandler({ event, step }),
);
