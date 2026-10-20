// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";

import { findContactOpportunity } from "@/lib/services/ghl";
import { TEST_IDS } from "@/test/ghl-ids";

import { markWebhookFailed } from "./ghl-webhook";

const TOKEN = "pit9Zq-ghl-token-91bd";
const outcomes: string[] = [];
vi.mock("@/db/client", () => ({
  db: {
    update: () => ({
      set: ({ outcome }: { outcome: string }) => ({
        where: async () => outcomes.push(outcome),
      }),
    }),
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("a GHL error the job records as its outcome never holds the token", async () => {
  vi.stubEnv("GHL_PRIVATE_TOKEN", TOKEN);
  vi.stubEnv("GHL_LOCATION_ID", "loc-test");
  vi.stubEnv("GHL_IDS", JSON.stringify(TEST_IDS));
  // GHL echoing the Authorization header back, placed so the message's cut falls inside the token.
  vi.stubGlobal(
    "fetch",
    async (_url: string, init: RequestInit) =>
      new Response(
        "x".repeat(285) +
          (init.headers as Record<string, string>).Authorization,
        { status: 401 },
      ),
  );
  const error = await findContactOpportunity("c-1").catch((e: Error) => e);
  expect(error).toBeInstanceOf(Error);
  await markWebhookFailed("row-1", error as Error);
  expect(outcomes).toHaveLength(1);
  expect(outcomes[0]).toMatch(/^failed: GHL 401/);
  expect(outcomes[0]).not.toContain(TOKEN.slice(0, 4));
});
