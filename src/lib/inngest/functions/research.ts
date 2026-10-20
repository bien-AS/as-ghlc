import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { z } from "zod";

import { db } from "@/db/client";
import { leadResearch, leads } from "@/db/schema";
import { inngest } from "@/lib/inngest/client";
import { briefMessages, parseBrief } from "@/lib/research/prompt";
import { MODEL_INFERENCE, type ResearchFacts } from "@/lib/research/schemas";
import { complete } from "@/lib/services/llm";
import { fetchSite, type SitePage } from "@/lib/services/research-fetch";

import { LEAD_VALIDATION_REQUESTED } from "./ghl-sync";

/*
 * The research brief job (spec 07, "Research brief"). Runs on intake (with
 * validation, spec 08) and on "Refresh research". Each run is one lead_research
 * row: 'generating', then 'ready' with the brief, facts and usage, or 'failed'
 * with the error, in which case the previous ready brief stays the one shown
 * (acceptance check 4). A run that dies where the job cannot catch it (a hard
 * timeout, or the 'failed' step itself failing) is marked failed by onFailure;
 * a cancelled one, which onFailure does not see, reads as failed once stale
 * (data/research.ts).
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

/** Caps the answer, and so the cost of one run; a brief is well under it. */
const MAX_OUTPUT_TOKENS = 8_000;

const NO_WEBSITE: { briefMd: string; facts: ResearchFacts } = {
  briefMd:
    "## No website on file\n\nThis lead gave no website, so there was nothing to research. " +
    "Add one in GHL and refresh the research.",
  facts: {
    summary: "No website on file; nothing was researched.",
    claims: [],
  },
};

/**
 * The run's row id, derived from Inngest's run id so onFailure, which only
 * knows that, can find the row. Formatted as a version 8 (custom) UUID.
 */
function rowIdFor(inngestRunId: string): string {
  const h = createHash("sha256").update(inngestRunId).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Opens the run: a 'generating' row. Idempotent, so a retried step does not trip on its own row. */
async function startRun(leadId: string, inngestRunId: string): Promise<string> {
  const id = rowIdFor(inngestRunId);
  await db
    .insert(leadResearch)
    .values({ id, leadId, status: "generating" })
    .onConflictDoNothing();
  return id;
}

/** A page URL as compared for grounding: no fragment, no trailing slash. */
function pageKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Claims may only cite pages the job fetched: the site's text is untrusted and
 * could steer the model to cite any URL, which the page shows as a source link.
 * Anything else is labelled as the model's inference.
 */
function groundClaims(claims: ResearchFacts["claims"], pages: SitePage[]) {
  const fetched = new Set(pages.map((page) => pageKey(page.url)));
  return claims.map((claim) =>
    claim.source === MODEL_INFERENCE || fetched.has(pageKey(claim.source))
      ? claim
      : { ...claim, source: MODEL_INFERENCE },
  );
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
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  const usage = {
    model: completion.model,
    inputTokens: completion.promptTokens,
    outputTokens: completion.completionTokens,
    // null when OpenRouter does not report it: not measured, never 0.
    costUsd: completion.cost === null ? null : String(completion.cost),
  };
  let brief: ReturnType<typeof parseBrief>;
  try {
    brief = parseBrief(completion.text);
  } catch (error) {
    // The call was paid for, so its usage is kept; asking again is another paid
    // call that is unlikely to differ, so this ends the run instead of retrying.
    await db.update(leadResearch).set(usage).where(eq(leadResearch.id, runId));
    throw new NonRetriableError(
      `The model's answer was not the brief asked for: ${(error as Error).message}`,
      { cause: error },
    );
  }
  const { markdown, summary, claims } = brief;
  const facts = { summary, claims: groundClaims(claims, pages) };
  await db
    .update(leadResearch)
    .set({ status: "ready", briefMd: markdown, facts, ...usage })
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

/** onFailure: the run ended without reaching 'ready' or 'failed', so its row is marked failed here. */
export async function markRunFailed(
  inngestRunId: string,
  error: { message: string },
): Promise<void> {
  await db
    .update(leadResearch)
    .set({ status: "failed", error: error.message })
    .where(
      and(
        eq(leadResearch.id, rowIdFor(inngestRunId)),
        eq(leadResearch.status, "generating"),
      ),
    );
}

/** The job body, exported for tests (which pass a step that just runs each body). */
export async function researchHandler({
  event,
  step,
  runId: inngestRunId,
}: {
  event: { data: unknown };
  step: Step;
  runId: string;
}) {
  const { leadId } = eventData.parse(event.data);
  const runId = (await step.run("start", () =>
    startRun(leadId, inngestRunId),
  )) as string;
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
    // Each retry of the brief step is another fetch and paid model call: at most 3 attempts.
    retries: 2,
    triggers: [
      { event: LEAD_RESEARCH_REQUESTED },
      { event: LEAD_VALIDATION_REQUESTED },
    ],
    onFailure: ({ event, error }) => markRunFailed(event.data.run_id, error),
  },
  ({ event, step, runId }) => researchHandler({ event, step, runId }),
);
