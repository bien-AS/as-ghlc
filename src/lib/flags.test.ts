import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";

import { FLAGGED_SCREENS, isLive } from "@/lib/flags";

afterEach(() => vi.unstubAllEnvs());

test("every flagged screen is a registry id", () => {
  const registry = JSON.parse(readFileSync("screen-registry.json", "utf8"));
  const ids = registry.screens.map((screen: { id: string }) => screen.id);
  for (const id of FLAGGED_SCREENS) expect(ids, id).toContain(id);
});

test("a mockup on sample data is live in development and not in production", () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(isLive("team-reps")).toBe(true);
  vi.stubEnv("NODE_ENV", "production");
  expect(isLive("team-reps")).toBe(false);
});

test("a live screen is live everywhere; an unflagged one nowhere", () => {
  for (const env of ["development", "production"]) {
    vi.stubEnv("NODE_ENV", env);
    expect(isLive("dashboard")).toBe(true);
    expect(isLive("lead-list")).toBe(true);
    expect(isLive("lead-detail")).toBe(true);
    expect(isLive("deck-library")).toBe(false);
    expect(isLive("no-such-screen")).toBe(false);
  }
});
