// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

import {
  AccessError,
  enforceRoute,
  getCurrentUser,
  getMe,
  requireProfile,
} from "@/lib/data/users";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);
vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationModule,
);

beforeEach(resetFakes);

const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

test("no session: signed out, and the guard refuses as unauthenticated", async () => {
  expect(await getCurrentUser()).toEqual({ status: "signed-out" });
  await expect(requireProfile()).rejects.toMatchObject({
    code: "unauthenticated",
  });
  await expect(getMe()).rejects.toBeInstanceOf(AccessError);
});

test("session without a profile: not provisioned, and the guard refuses as profile required", async () => {
  signIn();
  expect(await getCurrentUser()).toEqual({ status: "no-profile" });
  await expect(requireProfile()).rejects.toMatchObject({
    code: "profile_required",
  });
});

test("session with a profile: the profile, and the guard passes", async () => {
  signIn();
  fake.users.set(ada.id, ada);
  expect(await getCurrentUser()).toMatchObject({ status: "ready", user: ada });
  expect(await requireProfile()).toEqual({
    ...ada,
    role: "admin",
    active: true,
  });
  expect(await getMe()).toEqual(ada);
});

test("a session whose token carries no email is treated as signed out", async () => {
  signIn({ email: undefined });
  expect(await getCurrentUser()).toEqual({ status: "signed-out" });
});

test("a page sends an unprovisioned or deactivated session to /access-denied", async () => {
  signIn();
  await expect(enforceRoute("/dashboard")).rejects.toThrow(
    "redirect:/access-denied?reason=not_provisioned",
  );
  fake.users.set(ada.id, { ...ada, active: false });
  await expect(enforceRoute("/dashboard")).rejects.toThrow(
    "redirect:/access-denied?reason=deactivated",
  );
  fake.users.set(ada.id, ada);
  expect(await enforceRoute("/dashboard")).toMatchObject({ status: "ready" });
});

test.each([
  ["a password session", { amr: [{ method: "password", timestamp: 1 }] }],
  ["a magic-link session", { amr: ["otp"] }],
  ["a session with no amr", { amr: undefined }],
  ["a non-company email", { email: "ada@example.com" }],
  ["a look-alike domain", { email: "ada@evil-authoritysolutions.com" }],
])(
  "ADR-0008 check 1: %s on a provisioned, active profile is treated as signed out",
  async (_, claims) => {
    fake.users.set(ada.id, ada);
    signIn(claims);
    expect(await getCurrentUser()).toEqual({ status: "signed-out" });
    await expect(requireProfile()).rejects.toMatchObject({
      code: "unauthenticated",
    });
  },
);

test("ADR-0008 check 1: a Google session with a company email passes, in either amr format and any case", async () => {
  fake.users.set(ada.id, ada);
  for (const claims of [
    { amr: ["oauth"] },
    { email: "Ada@AuthoritySolutions.com" },
  ]) {
    signIn(claims);
    expect(await requireProfile()).toMatchObject({ id: ada.id });
  }
});
