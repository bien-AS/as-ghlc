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
