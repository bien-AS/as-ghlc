// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  AccessError,
  createProfile,
  createProfileSilently,
  getCurrentUser,
  getMe,
  requireUser,
  silentProfileNames,
} from "@/lib/data/users";
import { fake, prismaModule, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);

beforeEach(resetFakes);
afterEach(() => {
  vi.restoreAllMocks();
});

const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

test("no session: signed out, and the guard refuses as unauthenticated", async () => {
  expect(await getCurrentUser()).toEqual({ status: "signed-out" });
  await expect(requireUser()).rejects.toMatchObject({
    code: "unauthenticated",
  });
  await expect(getMe()).rejects.toBeInstanceOf(AccessError);
});

test("session without a User row: no profile, and the guard refuses as profile required", async () => {
  signIn();
  const current = await getCurrentUser();
  expect(current.status).toBe("no-profile");
  await expect(requireUser()).rejects.toMatchObject({
    code: "profile_required",
  });
});

test("session with a User row: the User, and the guard passes", async () => {
  signIn();
  fake.users.set(ada.id, ada);
  expect(await getCurrentUser()).toMatchObject({ status: "ready", user: ada });
  expect(await requireUser()).toEqual(ada);
  expect(await getMe()).toEqual(ada);
});

test("a session whose token carries no email is treated as signed out", async () => {
  signIn({ email: undefined });
  expect(await getCurrentUser()).toEqual({ status: "signed-out" });
});

test("creating a profile takes the id and email from the session", async () => {
  signIn();
  const user = await createProfile({ firstName: "Ada", lastName: "Lovelace" });
  expect(user).toEqual(ada);
  expect(fake.users.get("auth-user-1")).toEqual(ada);
});

test("an id or email supplied by the caller is ignored", async () => {
  signIn();
  const hostile = {
    firstName: "Ada",
    lastName: "Lovelace",
    id: "someone-else",
    email: "victim@example.com",
  };
  const user = await createProfile(hostile);
  expect(user.id).toBe("auth-user-1");
  expect(user.email).toBe("ada@example.com");
  expect(fake.users.has("someone-else")).toBe(false);
  expect(fake.users.size).toBe(1);
});

test("creating twice yields one row and no error", async () => {
  signIn();
  await createProfile({ firstName: "Ada", lastName: "Lovelace" });
  const again = await createProfile({ firstName: "Other", lastName: "Name" });
  expect(again).toEqual(ada);
  expect(fake.users.size).toBe(1);
});

test("another profile already using the email is reported distinctly", async () => {
  fake.users.set("older-user", { ...ada, id: "older-user" });
  signIn();
  await expect(
    createProfile({ firstName: "Ada", lastName: "Lovelace" }),
  ).rejects.toMatchObject({ code: "email_conflict" });
  expect(fake.users.has("auth-user-1")).toBe(false);
});

test("creating a profile while signed out is refused", async () => {
  await expect(
    createProfile({ firstName: "Ada", lastName: "Lovelace" }),
  ).rejects.toMatchObject({ code: "unauthenticated" });
  expect(fake.users.size).toBe(0);
});

const signUpNames = { dw_first_name: "Ada", dw_last_name: "Lovelace" };

async function identity() {
  const current = await getCurrentUser();
  if (current.status !== "no-profile") throw new Error("expected no profile");
  return current.identity;
}

test("silent path: an emailed-link session with both sign-up names", async () => {
  signIn({
    amr: [{ method: "otp", timestamp: 1 }],
    user_metadata: signUpNames,
  });
  expect(silentProfileNames(await identity())).toEqual({
    firstName: "Ada",
    lastName: "Lovelace",
  });
});

test("silent path: an email-and-password session with both sign-up names", async () => {
  signIn({ user_metadata: signUpNames });
  expect(silentProfileNames(await identity())).toEqual({
    firstName: "Ada",
    lastName: "Lovelace",
  });
});

test("silent path: never for a Google session, even when names are available", async () => {
  signIn({
    amr: [{ method: "oauth", timestamp: 1 }],
    user_metadata: { ...signUpNames, full_name: "Ada Lovelace" },
  });
  const who = await identity();
  expect(silentProfileNames(who)).toBeNull();
  // The form is prefilled instead.
  expect(who.suggestedNames).toEqual({
    firstName: "Ada",
    lastName: "Lovelace",
  });
});

test("silent path: a missing or blank name shows the form", async () => {
  signIn({ user_metadata: { dw_first_name: "Ada" } });
  expect(silentProfileNames(await identity())).toBeNull();
  signIn({ user_metadata: { dw_first_name: "Ada", dw_last_name: "   " } });
  expect(silentProfileNames(await identity())).toBeNull();
});

test("the Google display name is split to prefill the form", async () => {
  signIn({
    amr: [{ method: "oauth", timestamp: 1 }],
    user_metadata: { full_name: "Grace Brewster Hopper" },
  });
  expect((await identity()).suggestedNames).toEqual({
    firstName: "Grace",
    lastName: "Brewster Hopper",
  });
  signIn({ amr: ["oauth"], user_metadata: {} });
  expect((await identity()).suggestedNames).toEqual({
    firstName: "",
    lastName: "",
  });
});

// --- The silent path as a write (POST /api/profile/silent) ---

const PERSONAL = [
  "ada@example.com",
  "Ada",
  "Lovelace",
  "auth-user-1",
  "older-user",
];

/** Everything written to the server log, as one string. */
function logged(spy: { mock: { calls: unknown[][] } }) {
  return JSON.stringify(spy.mock.calls);
}

test("silent creation: makes the row from the session for an email session with both names", async () => {
  signIn({ user_metadata: signUpNames });
  expect(await createProfileSilently()).toEqual(ada);
  expect(fake.users.get("auth-user-1")).toEqual(ada);
});

test("silent creation: asked twice, or at the same moment, still one row and no error", async () => {
  signIn({ user_metadata: signUpNames });
  const [first, second] = await Promise.all([
    createProfileSilently(),
    createProfileSilently(),
  ]);
  expect(first).toEqual(ada);
  expect(second).toEqual(ada);
  expect(await createProfileSilently()).toEqual(ada);
  expect(fake.users.size).toBe(1);
});

test("silent creation: never for a Google session; the form is required and nothing is written or logged", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  signIn({
    amr: [{ method: "oauth", timestamp: 1 }],
    user_metadata: { ...signUpNames, full_name: "Ada Lovelace" },
  });
  expect(await createProfileSilently()).toBeNull();
  expect(fake.users.size).toBe(0);
  expect(log).not.toHaveBeenCalled();
});

test("silent creation: a missing name requires the form", async () => {
  signIn({ user_metadata: { dw_first_name: "Ada" } });
  expect(await createProfileSilently()).toBeNull();
  expect(fake.users.size).toBe(0);
});

test("silent creation: signed out is refused", async () => {
  await expect(createProfileSilently()).rejects.toMatchObject({
    code: "unauthenticated",
  });
});

test("silent creation: an email conflict ends on the form and is logged without personal data", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  fake.users.set("older-user", { ...ada, id: "older-user" });
  signIn({ user_metadata: signUpNames });

  expect(await createProfileSilently()).toBeNull();
  expect(fake.users.has("auth-user-1")).toBe(false);

  expect(log).toHaveBeenCalledTimes(1);
  expect(log.mock.calls[0][1]).toEqual({
    step: "create-profile",
    name: "AccessError",
    code: "email_conflict",
  });
  for (const value of PERSONAL) expect(logged(log)).not.toContain(value);
});

test("silent creation: a database failure ends on the form and logs the kind of error, never its message", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  // A driver error whose message quotes the row it was writing.
  vi.spyOn(prismaModule.prisma.user, "create").mockRejectedValueOnce(
    Object.assign(
      new Error(
        "insert failed for (auth-user-1, ada@example.com, Ada, Lovelace)",
      ),
      { name: "PrismaClientKnownRequestError", code: "P1001" },
    ),
  );
  signIn({ user_metadata: signUpNames });

  expect(await createProfileSilently()).toBeNull();
  expect(log.mock.calls[0][1]).toEqual({
    step: "create-profile",
    name: "PrismaClientKnownRequestError",
    code: "P1001",
  });
  for (const value of PERSONAL) expect(logged(log)).not.toContain(value);
});

test("silent creation: a failure while resolving the session names that step", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(prismaModule.prisma.user, "findUnique").mockRejectedValueOnce(
    Object.assign(new Error("cannot reach database for ada@example.com"), {
      name: "PrismaClientInitializationError",
    }),
  );
  signIn({ user_metadata: signUpNames });

  expect(await createProfileSilently()).toBeNull();
  expect(log.mock.calls[0][1]).toEqual({
    step: "resolve-session",
    name: "PrismaClientInitializationError",
    code: undefined,
  });
  for (const value of PERSONAL) expect(logged(log)).not.toContain(value);
});
