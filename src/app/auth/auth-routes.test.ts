// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

import { GET as callback } from "@/app/auth/callback/route";
import { dbModule, fake, resetFakes } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);
const welcome = vi.hoisted(() => ({ live: true }));
vi.mock("@/lib/flags", () => ({
  isLive: (screen: string) => screen === "welcome-first-run" && welcome.live,
}));

const ORIGIN = "http://localhost:3000";
const request = (path: string) => new NextRequest(`${ORIGIN}${path}`);
const location = (response: Response) => {
  expect(response.status).toBe(307);
  return response.headers.get("location")?.replace(ORIGIN, "");
};

const ZACH = {
  id: "auth-user-zach",
  email: "zachery@authoritysolutions.com",
  firstName: "Zachery",
  lastName: "Ross",
};

/** What the code exchange returns: the auth user and its Google identity. */
function googleReturns(email: string, emailVerified = true) {
  fake.exchangeCodeForSession.mockResolvedValue({
    data: {
      user: {
        id: ZACH.id,
        email,
        identities: [
          {
            provider: "google",
            identity_data: { email, email_verified: emailVerified },
          },
        ],
      },
      session: {},
    },
    error: null,
  });
}

beforeEach(() => {
  resetFakes();
  welcome.live = true;
  googleReturns(ZACH.email);
  fake.users.set(ZACH.id, { ...ZACH, firstRun: false });
});

const signIn = (query = "") =>
  callback(request(`/auth/callback?code=xyz${query}`));

test("a provisioned, active company account lands on the dashboard", async () => {
  expect(location(await signIn())).toBe("/dashboard");
  expect(fake.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
  expect(fake.signOut).not.toHaveBeenCalled();
});

test("on first run it lands on /welcome", async () => {
  fake.users.set(ZACH.id, { ...ZACH, firstRun: true });
  expect(location(await signIn())).toBe("/welcome");
});

test("on first run, while /welcome is not live, it lands on the dashboard", async () => {
  welcome.live = false;
  fake.users.set(ZACH.id, { ...ZACH, firstRun: true });
  expect(location(await signIn())).toBe("/dashboard");
});

test("the remembered page inside the app wins, even on first run", async () => {
  fake.users.set(ZACH.id, { ...ZACH, firstRun: true });
  expect(location(await signIn("&next=%2Fleads%2F42%3Ftab%3Dnotes"))).toBe(
    "/leads/42?tab=notes",
  );
});

test.each([
  "https://evil.example/dashboard",
  "//evil.example",
  "/\\evil.example",
  "/login",
])("an off-site or non-app next (%s) is ignored", async (next) => {
  expect(location(await signIn(`&next=${encodeURIComponent(next)}`))).toBe(
    "/dashboard",
  );
});

test.each([
  [
    "a non-company email",
    () => googleReturns("zachery@gmail.com"),
    "not_company",
  ],
  [
    "a look-alike domain",
    () => googleReturns("zachery@evil-authoritysolutions.com"),
    "not_company",
  ],
  [
    "an unverified company email",
    () => googleReturns(ZACH.email, false),
    "not_company",
  ],
  [
    "an unprovisioned company account",
    () => fake.users.clear(),
    "not_provisioned",
  ],
  [
    "a deactivated account",
    () => fake.users.set(ZACH.id, { ...ZACH, active: false }),
    "deactivated",
  ],
])(
  "%s ends signed out on /access-denied with the reason",
  async (_name, arrange, reason) => {
    arrange();
    expect(location(await signIn("&next=%2Fleads%2F42"))).toBe(
      `/access-denied?reason=${reason}`,
    );
    expect(fake.signOut).toHaveBeenCalledTimes(1);
  },
);

test("a profile read that fails signs out and returns to /login", async () => {
  vi.spyOn(dbModule.db.query.profiles, "findFirst").mockRejectedValueOnce(
    new Error("db down"),
  );
  expect(location(await signIn())).toBe("/login?notice=google_failed");
  expect(fake.signOut).toHaveBeenCalledTimes(1);
});

test("a failed exchange returns to /login with the notice", async () => {
  fake.exchangeCodeForSession.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: "bad_code_verifier" },
  });
  expect(location(await signIn())).toBe("/login?notice=google_failed");
});

test("cancelled at Google (no code) returns to /login with the notice", async () => {
  const response = await callback(
    request("/auth/callback?error=access_denied&next=%2Fdashboard"),
  );
  expect(fake.exchangeCodeForSession).not.toHaveBeenCalled();
  expect(location(response)).toBe("/login?notice=google_failed");
});
