// @vitest-environment node
import "dotenv/config";

import { describe, expect, test, vi } from "vitest";

import { checkGhlIds } from "@/lib/services/ghl";

/*
 * Spec 06 acceptance check 1 against a real location, read-only (GET only).
 * Runs only when GHL_IDS and GHL_PRIVATE_TOKEN are set, for example:
 *   GHL_IDS='{...}' pnpm exec vitest run src/lib/services/ghl/live.test.ts
 */

const LIVE = Boolean(process.env.GHL_IDS && process.env.GHL_PRIVATE_TOKEN);
const SUITE = LIVE
  ? "GHL startup check (live, read-only)"
  : "GHL startup check (live): SKIPPED, GHL_IDS or GHL_PRIVATE_TOKEN is not set";

describe.skipIf(!LIVE)(SUITE, () => {
  test("every configured id resolves in the location", async () => {
    expect(await checkGhlIds()).toEqual([]);
  });

  test("one wrong id is named", async () => {
    const ids = JSON.parse(process.env.GHL_IDS as string);
    ids.opportunityFields.lead_status = "not-a-field-id";
    vi.stubEnv("GHL_IDS", JSON.stringify(ids));
    try {
      expect(await checkGhlIds()).toEqual([
        "opportunityFields.lead_status (not-a-field-id)",
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
