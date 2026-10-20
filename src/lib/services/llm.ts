import { z } from "zod";

/*
 * The ONE caller of OpenRouter in the app (spec 01): every model call goes through
 * `complete`. Server only, since it reads OPENROUTER_API_KEY.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
/** A call that has not answered by then is abandoned, so a hung request cannot hold a job open. */
const TIMEOUT_MS = 120_000;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type Completion = {
  text: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  /** USD as OpenRouter reports it; null when it does not, never a guessed 0. */
  cost: number | null;
};

const responseSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      cost: z.number().optional(),
    })
    .optional(),
});

/** One chat completion. `model` defaults to OPENROUTER_MODEL; `maxTokens` caps the answer (and its cost). */
export async function complete({
  messages,
  model = process.env.OPENROUTER_MODEL,
  maxTokens,
}: {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<Completion> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  if (!model) throw new Error("No model given and OPENROUTER_MODEL is not set");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((error: unknown) => {
    // A message of our own, so nothing from the request (its key) can reach a log.
    if ((error as { name?: unknown } | null)?.name === "TimeoutError") {
      throw new Error(
        `OpenRouter did not answer within ${TIMEOUT_MS / 1000}s for model ${model}`,
      );
    }
    throw error;
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status} for model ${model}`);
  }

  const data = responseSchema.parse(await res.json());
  const result: Completion = {
    text: data.choices[0].message.content ?? "",
    model: data.model ?? model,
    promptTokens: data.usage?.prompt_tokens ?? null,
    completionTokens: data.usage?.completion_tokens ?? null,
    cost: data.usage?.cost ?? null,
  };
  console.info(
    `[llm] model=${result.model} prompt_tokens=${result.promptTokens} ` +
      `completion_tokens=${result.completionTokens} cost=${result.cost}`,
  );
  return result;
}
