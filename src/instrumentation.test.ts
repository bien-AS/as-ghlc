// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { TEST_IDS } from "@/test/ghl-ids";

import { register } from "./instrumentation";

/*
 * The startup check's error handling (spec 06 check 1): GHL being unreachable
 * (network, 429, 5xx) is logged and the server starts; any other answer, a 4xx
 * such as a wrong GHL_LOCATION_ID, refuses to start.
 */

const answer = (response: Response | Error) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response.clone();
    }),
  );

beforeEach(() => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("GHL_PRIVATE_TOKEN", "pit-test-token");
  vi.stubEnv("GHL_LOCATION_ID", "loc-wrong");
  vi.stubEnv("GHL_IDS", JSON.stringify(TEST_IDS));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each([400, 401, 403, 404, 422])(
  "a %i from GHL refuses to start",
  async (status) => {
    answer(new Response("no such location", { status }));
    await expect(register()).rejects.toThrow(`GHL ${status}`);
  },
);

test.each([
  ["a network error", new TypeError("fetch failed")],
  ["a 500", new Response("down", { status: 500 })],
  ["a 503", new Response("down", { status: 503 })],
  // Past the 60s backoff cap, ghlRequest gives up with a 429.
  [
    "a long 429",
    new Response("slow", { status: 429, headers: { "Retry-After": "600" } }),
  ],
])("%s is logged as unreachable and the server starts", async (_, response) => {
  answer(response);
  await expect(register()).resolves.toBeUndefined();
  expect(console.error).toHaveBeenCalledWith(
    "[ghl] startup check could not reach GHL:",
    expect.any(String),
  );
});
