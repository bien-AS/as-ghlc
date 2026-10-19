import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { complete } from "@/lib/services/llm";

const messages = [{ role: "user" as const, content: "hi" }];

function stubOpenRouter(usage?: Record<string, number>) {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const { model } = JSON.parse(init.body as string);
    return Response.json({
      model,
      choices: [{ message: { content: "hello" } }],
      usage,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const sentModel = (fetchMock: ReturnType<typeof stubOpenRouter>) =>
  JSON.parse(fetchMock.mock.calls[0][1].body as string).model;

let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "default/model");
  log = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("uses OPENROUTER_MODEL by default and logs model, tokens and cost", async () => {
  const fetchMock = stubOpenRouter({
    prompt_tokens: 12,
    completion_tokens: 34,
    cost: 0.0021,
  });

  const result = await complete({ messages });

  expect(sentModel(fetchMock)).toBe("default/model");
  expect(result).toEqual({
    text: "hello",
    model: "default/model",
    promptTokens: 12,
    completionTokens: 34,
    cost: 0.0021,
  });
  expect(log).toHaveBeenCalledWith(
    "[llm] model=default/model prompt_tokens=12 completion_tokens=34 cost=0.0021",
  );
});

test("honours a caller's model", async () => {
  const fetchMock = stubOpenRouter({ prompt_tokens: 1, completion_tokens: 1 });

  const result = await complete({ messages, model: "other/model" });

  expect(sentModel(fetchMock)).toBe("other/model");
  expect(result.model).toBe("other/model");
});

test("cost is null, never 0, when OpenRouter does not report it", async () => {
  stubOpenRouter();

  const result = await complete({ messages });

  expect(result.cost).toBeNull();
  expect(result.promptTokens).toBeNull();
  expect(log).toHaveBeenCalledWith(expect.stringContaining("cost=null"));
});
