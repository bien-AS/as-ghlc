import { z } from "zod";

/*
 * The research brief (spec 07, "Research brief"): what the model must return,
 * what lead_research.facts holds, and what GET /api/leads/[leadId]/research answers.
 */

/** A claim's source: the page it was read on, or the model's own inference. */
export const MODEL_INFERENCE = "model inference";

/**
 * assumed: GHL's Validation Summary is a large-text field (spec 06) and W1
 * writes the brief's summary into it (spec 07, 08); 1,000 characters keeps it
 * readable there and in the review queue.
 */
export const SUMMARY_MAX_CHARS = 1000;

export const claimSchema = z.object({
  claim: z.string().trim().min(1),
  source: z.union([z.httpUrl(), z.literal(MODEL_INFERENCE)]),
});

/** lead_research.facts: the short summary W1 sends, and every claim with its source. */
export const researchFactsSchema = z.object({
  summary: z.string().trim().min(1).max(SUMMARY_MAX_CHARS),
  claims: z.array(claimSchema),
});

/** The model's answer: the facts plus the brief as markdown. */
export const briefOutputSchema = researchFactsSchema.extend({
  markdown: z.string().trim().min(1),
});

export type Claim = z.infer<typeof claimSchema>;
export type ResearchFacts = z.infer<typeof researchFactsSchema>;
export type BriefOutput = z.infer<typeof briefOutputSchema>;

/** The brief shown on the lead: the latest ready run. */
export type ResearchBrief = {
  id: string;
  briefMd: string;
  facts: ResearchFacts;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  /** USD; null when not measured, never 0. */
  costUsd: number | null;
  createdAt: string;
};

/** GET /api/leads/[leadId]/research. */
export type LeadResearch = {
  /** The latest ready brief, or null when none has finished yet. */
  brief: ResearchBrief | null;
  /** The newest run when it is not that brief: still generating, or failed (with why). */
  run: {
    status: "generating" | "failed";
    error: string | null;
    createdAt: string;
  } | null;
  /** The cost line for the Refresh research modal: "≈ $0.02 per run" or "Not measured". */
  costEstimate: string;
};
