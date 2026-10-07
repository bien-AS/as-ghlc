import { expect, test } from "vitest";

import { safeRedirectTarget } from "@/lib/auth/redirect-target";

test("keeps a path inside the app, with its query and hash", () => {
  expect(safeRedirectTarget("/dashboard/leads/42?tab=notes#top")).toBe(
    "/dashboard/leads/42?tab=notes#top",
  );
  expect(safeRedirectTarget("/dashboard")).toBe("/dashboard");
});

test.each([
  ["nothing", undefined],
  ["null", null],
  ["an empty value", ""],
  ["an absolute URL", "https://evil.example/dashboard"],
  ["a protocol-relative URL", "//evil.example"],
  ["a protocol-relative URL with a path", "//evil.example/dashboard"],
  ["a backslash variant", "/\\evil.example"],
  ["a double backslash", "\\\\evil.example"],
  ["a backslash later in the path", "/dashboard\\..\\evil"],
  ["a tab that a URL parser would strip", "/\t/evil.example"],
  ["a newline that a URL parser would strip", "/\n/evil.example"],
  ["a javascript: URL", "javascript:alert(1)"],
  ["a relative path without a leading slash", "dashboard"],
  ["a path that normalises to protocol-relative", "/..//evil.example"],
  ["a scheme without slashes", "https:evil.example"],
])("falls back to the dashboard for %s", (_name, value) => {
  expect(safeRedirectTarget(value)).toBe("/dashboard");
});
