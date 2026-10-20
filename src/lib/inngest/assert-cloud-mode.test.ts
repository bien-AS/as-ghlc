import { expect, test } from "vitest";

import { assertCloudModeOnDeployment } from "@/lib/inngest/assert-cloud-mode";

test("throws when INNGEST_DEV is set on a deployment", () => {
  expect(() =>
    assertCloudModeOnDeployment({ INNGEST_DEV: "1", VERCEL_ENV: "preview" }),
  ).toThrow(/INNGEST_DEV is set on a deployed environment/);
  // Any value, not only the ones the SDK reads as dev mode.
  expect(() =>
    assertCloudModeOnDeployment({ INNGEST_DEV: "0", VERCEL_ENV: "production" }),
  ).toThrow();
});

test.each([
  [{ INNGEST_DEV: "1" }],
  [{ VERCEL_ENV: "production" }],
  [{ INNGEST_DEV: "", VERCEL_ENV: "production" }],
  [{}],
])("passes for %o", (env) => {
  expect(() => assertCloudModeOnDeployment(env)).not.toThrow();
});
