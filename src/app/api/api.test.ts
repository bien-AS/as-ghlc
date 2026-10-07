// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

import { GET as getMe } from "@/app/api/me/route";
import { POST as postProfile } from "@/app/api/profile/route";
import * as silentRoute from "@/app/api/profile/silent/route";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);

beforeEach(resetFakes);

const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

const post = (body: unknown) =>
  postProfile(
    new Request("http://localhost:3000/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

test("GET /api/me signed out: 401", async () => {
  const response = await getMe();
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: { code: "unauthenticated" } });
});

test("GET /api/me signed in without a profile: 403 profile_required", async () => {
  signIn();
  const response = await getMe();
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({
    error: { code: "profile_required" },
  });
});

test("GET /api/me with a profile: the User", async () => {
  signIn();
  fake.users.set(ada.id, ada);
  const response = await getMe();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(ada);
});

test("POST /api/profile creates the row from the session id and email", async () => {
  signIn();
  const response = await post({ firstName: " Ada ", lastName: "Lovelace" });
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual(ada);
  expect(fake.users.get("auth-user-1")).toEqual(ada);
});

test("POST /api/profile rejects a client-supplied id or email and writes nothing", async () => {
  signIn();
  for (const extra of [
    { id: "someone-else" },
    { email: "victim@example.com" },
    { role: "admin" },
  ]) {
    const response = await post({
      firstName: "Ada",
      lastName: "Lovelace",
      ...extra,
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_input");
  }
  expect(fake.users.size).toBe(0);
});

test("POST /api/profile rejects missing, blank, over-long and malformed input", async () => {
  signIn();
  for (const body of [
    {},
    { firstName: "Ada" },
    { firstName: "   ", lastName: "Lovelace" },
    { firstName: "A".repeat(101), lastName: "Lovelace" },
    { firstName: 1, lastName: 2 },
    "not json",
    null,
  ]) {
    const response = await post(body);
    expect(response.status).toBe(400);
  }
  const response = await post({ firstName: "", lastName: "Lovelace" });
  expect((await response.json()).error.fields.firstName).toEqual([
    "Enter your first name.",
  ]);
  expect(fake.users.size).toBe(0);
});

test("POST /api/profile signed out: 401, nothing written", async () => {
  const response = await post({ firstName: "Ada", lastName: "Lovelace" });
  expect(response.status).toBe(401);
  expect(fake.users.size).toBe(0);
});

test("POST /api/profile signed out with an invalid body: 401, not 400, nothing written", async () => {
  for (const body of [
    {},
    { firstName: "" },
    { id: "someone-else" },
    "not json",
  ]) {
    const response = await post(body);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated" },
    });
  }
  expect(fake.users.size).toBe(0);
});

test("POST /api/profile twice: one row, no error", async () => {
  signIn();
  await post({ firstName: "Ada", lastName: "Lovelace" });
  const response = await post({ firstName: "Ada", lastName: "Lovelace" });
  expect(response.status).toBe(201);
  expect(fake.users.size).toBe(1);
});

test("POST /api/profile when another profile uses the email: 409 email_conflict", async () => {
  fake.users.set("older-user", { ...ada, id: "older-user" });
  signIn();
  const response = await post({ firstName: "Ada", lastName: "Lovelace" });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: { code: "email_conflict" } });
});

// --- POST /api/profile/silent ---

const signUpNames = { dw_first_name: "Ada", dw_last_name: "Lovelace" };

test("POST /api/profile/silent creates the profile from the session alone", async () => {
  signIn({ user_metadata: signUpNames });
  const response = await silentRoute.POST();
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual(ada);
  expect(fake.users.get("auth-user-1")).toEqual(ada);
});

test("POST /api/profile/silent for a Google session: 409 profile_form_required, nothing written", async () => {
  signIn({
    amr: [{ method: "oauth", timestamp: 1 }],
    user_metadata: signUpNames,
  });
  const response = await silentRoute.POST();
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: { code: "profile_form_required" },
  });
  expect(fake.users.size).toBe(0);
});

test("POST /api/profile/silent signed out: 401", async () => {
  const response = await silentRoute.POST();
  expect(response.status).toBe(401);
});

test("POST /api/profile/silent when the profile exists: the User, still one row", async () => {
  signIn({ user_metadata: signUpNames });
  fake.users.set(ada.id, ada);
  const response = await silentRoute.POST();
  expect(response.status).toBe(201);
  expect(fake.users.size).toBe(1);
});

test("a prefetch-style request cannot create a profile: the silent route answers POST only", () => {
  // Next.js answers 405 for a method a route file does not export.
  expect(Object.keys(silentRoute)).toEqual(["POST"]);
});
