// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

import { GET as callback } from "@/app/auth/callback/route";
import { GET as confirm } from "@/app/auth/confirm/route";
import { fake, resetFakes } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);

beforeEach(resetFakes);

const ORIGIN = "http://localhost:3000";
const request = (path: string) => new NextRequest(`${ORIGIN}${path}`);
const location = (response: Response) => {
  expect(response.status).toBe(307);
  return response.headers.get("location")?.replace(ORIGIN, "");
};
const refused = { data: {}, error: { code: "otp_expired" } };

test("confirmation link: verifies the token hash and goes to the dashboard", async () => {
  const response = await confirm(
    request("/auth/confirm?token_hash=abc&type=email"),
  );
  expect(fake.verifyOtp).toHaveBeenCalledWith({
    type: "email",
    token_hash: "abc",
  });
  expect(location(response)).toBe("/dashboard");
});

test("confirmation link: honours a remembered path inside the app", async () => {
  const response = await confirm(
    request(
      "/auth/confirm?token_hash=abc&type=email&next=%2Fdashboard%2Fleads%2F42",
    ),
  );
  expect(location(response)).toBe("/dashboard/leads/42");
});

test.each(["https://evil.example", "//evil.example", "/\\evil.example"])(
  "confirmation link: still verifies, but ignores the outside destination %s",
  async (next) => {
    const response = await confirm(
      request(
        `/auth/confirm?token_hash=abc&type=email&next=${encodeURIComponent(next)}`,
      ),
    );
    expect(fake.verifyOtp).toHaveBeenCalled();
    expect(location(response)).toBe("/dashboard");
  },
);

test("recovery link: goes to the new-password form, whatever `next` says", async () => {
  const response = await confirm(
    request("/auth/confirm?token_hash=abc&type=recovery&next=%2Fdashboard"),
  );
  expect(fake.verifyOtp).toHaveBeenCalledWith({
    type: "recovery",
    token_hash: "abc",
  });
  expect(location(response)).toBe("/reset-password/update");
});

test("expired, used or altered confirmation link: sign-in with the notice", async () => {
  fake.verifyOtp.mockResolvedValue(refused);
  const response = await confirm(
    request("/auth/confirm?token_hash=abc&type=email"),
  );
  expect(location(response)).toBe("/sign-in?notice=link_invalid");
});

test("expired, used or altered recovery link: reset request with the notice", async () => {
  fake.verifyOtp.mockResolvedValue(refused);
  const response = await confirm(
    request("/auth/confirm?token_hash=abc&type=recovery"),
  );
  expect(location(response)).toBe("/reset-password?notice=link_invalid");
});

test.each([
  [
    "a missing token",
    "/auth/confirm?type=email",
    "/sign-in?notice=link_invalid",
  ],
  [
    "a missing type",
    "/auth/confirm?token_hash=abc",
    "/sign-in?notice=link_invalid",
  ],
  [
    "an unknown type",
    "/auth/confirm?token_hash=abc&type=magiclink",
    "/sign-in?notice=link_invalid",
  ],
  ["nothing at all", "/auth/confirm", "/sign-in?notice=link_invalid"],
  [
    "a recovery link missing its token",
    "/auth/confirm?type=recovery",
    "/reset-password?notice=link_invalid",
  ],
])(
  "%s is an invalid link and is never sent to Supabase",
  async (_name, path, expected) => {
    const response = await confirm(request(path));
    expect(fake.verifyOtp).not.toHaveBeenCalled();
    expect(location(response)).toBe(expected);
  },
);

test("Supabase unreachable while verifying: treated as an invalid link", async () => {
  fake.verifyOtp.mockRejectedValue(new TypeError("fetch failed"));
  const response = await confirm(
    request("/auth/confirm?token_hash=abc&type=email"),
  );
  expect(location(response)).toBe("/sign-in?notice=link_invalid");
});

test("Google callback: exchanges the code and goes to the dashboard", async () => {
  const response = await callback(request("/auth/callback?code=xyz"));
  expect(fake.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
  expect(location(response)).toBe("/dashboard");
});

test("Google callback: honours a remembered path inside the app", async () => {
  const response = await callback(
    request("/auth/callback?code=xyz&next=%2Fdashboard%2Fleads%2F42"),
  );
  expect(location(response)).toBe("/dashboard/leads/42");
});

test("Google callback: ignores a destination outside the app", async () => {
  const response = await callback(
    request("/auth/callback?code=xyz&next=https%3A%2F%2Fevil.example"),
  );
  expect(location(response)).toBe("/dashboard");
});

test("Google callback: a failed exchange returns to sign-in with the notice", async () => {
  fake.exchangeCodeForSession.mockResolvedValue({
    data: {},
    error: { code: "bad_code_verifier" },
  });
  const response = await callback(request("/auth/callback?code=xyz"));
  expect(location(response)).toBe("/sign-in?notice=google_failed");
});

test("Google callback: cancelled at Google (no code) returns to sign-in with the notice", async () => {
  const response = await callback(
    request("/auth/callback?error=access_denied&next=%2Fdashboard"),
  );
  expect(fake.exchangeCodeForSession).not.toHaveBeenCalled();
  expect(location(response)).toBe("/sign-in?notice=google_failed");
});
