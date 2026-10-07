// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  GET as getPreferences,
  PUT as putPreferences,
} from "@/app/api/account/preferences/route";
import { GET as getMeRoute } from "@/app/api/me/route";
import { PATCH as patchProfile } from "@/app/api/profile/route";
import { accountPreferencesSchema } from "@/lib/account/schemas";
import {
  getAccountPreferences,
  mutedNotificationTypes,
  updateAccountPreferences,
} from "@/lib/data/account";
import { resetSampleLeads } from "@/lib/data/leads";
import { updateProfile } from "@/lib/data/users";
import { PREVIEW_ROLE_COOKIE } from "@/lib/data/viewer";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);

const ORIGIN = "http://localhost:3000";
const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};
const grace = {
  id: "auth-user-2",
  email: "grace@example.com",
  firstName: "Grace",
  lastName: "Hopper",
};
const ALL_ON = {
  notifications: {
    suspect_to_review: true,
    proposal_signed: true,
    invoice_draft_ready: true,
  },
};
const NO_INVOICES = {
  notifications: { ...ALL_ON.notifications, invoice_draft_ready: false },
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-10-07T12:00:00.000Z"),
  });
  resetFakes();
  resetSampleLeads();
  signIn();
  fake.users.set(ada.id, ada);
  fake.users.set(grace.id, grace);
});
afterEach(() => vi.useRealTimers());

const refusedWith = (code: string) => expect.objectContaining({ code });
const send = (
  handler: (request: Request) => Promise<Response>,
  method: string,
  path: string,
  body: unknown,
) =>
  handler(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const put = (body: unknown) =>
  send(putPreferences, "PUT", "/api/account/preferences", body);
const patch = (body: unknown) =>
  send(patchProfile, "PATCH", "/api/profile", body);

// --- preferences ---------------------------------------------------------------

test("until a person chooses otherwise every notification type is on, and the defaults match the contract", async () => {
  const preferences = await getAccountPreferences();
  expect(accountPreferencesSchema.parse(preferences)).toEqual(ALL_ON);
  expect(await mutedNotificationTypes()).toEqual(new Set());
});

test("a saved choice shows in a later read, for every role the person previews", async () => {
  expect(await updateAccountPreferences(NO_INVOICES)).toEqual(NO_INVOICES);
  expect(await getAccountPreferences()).toEqual(NO_INVOICES);
  expect(await mutedNotificationTypes()).toEqual(
    new Set(["invoice_draft_ready"]),
  );

  // Personal, not a Workspace resource: staff have it too, and it is the same person's.
  fake.cookies.set(PREVIEW_ROLE_COOKIE, "staff");
  expect(await getAccountPreferences()).toEqual(NO_INVOICES);
});

test("preferences belong to one person: another signed-in user still has the defaults", async () => {
  await updateAccountPreferences(NO_INVOICES);

  signIn({ sub: grace.id, email: grace.email });
  expect(await getAccountPreferences()).toEqual(ALL_ON);
  await updateAccountPreferences({
    notifications: { ...ALL_ON.notifications, proposal_signed: false },
  });

  signIn();
  expect(await getAccountPreferences()).toEqual(NO_INVOICES);
});

test("what a read returns cannot be used to change the store", async () => {
  const preferences = await getAccountPreferences();
  preferences.notifications.proposal_signed = false;
  expect(await getAccountPreferences()).toEqual(ALL_ON);
});

test("GET and PUT /api/account/preferences read and replace the person's own preferences", async () => {
  const before = await getPreferences();
  expect(before.status).toBe(200);
  expect(await before.json()).toEqual(ALL_ON);

  const saved = await put(NO_INVOICES);
  expect(saved.status).toBe(200);
  expect(await saved.json()).toEqual(NO_INVOICES);
  expect(await (await getPreferences()).json()).toEqual(NO_INVOICES);
});

test.each([
  ["a missing type", { notifications: { suspect_to_review: true } }],
  [
    "an unknown type",
    { notifications: { ...ALL_ON.notifications, weekly_digest: true } },
  ],
  [
    "a value that is not on or off",
    { notifications: { ...ALL_ON.notifications, proposal_signed: "no" } },
  ],
  ["an extra field", { ...ALL_ON, theme: "dark" }],
  ["a body that is not JSON", "not json"],
])(
  "PUT /api/account/preferences rejects %s and changes nothing",
  async (_case, body) => {
    const response = await put(body);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_input");
    expect(await getAccountPreferences()).toEqual(ALL_ON);
  },
);

test("preferences refuse a caller with no profile (403) and a signed-out caller (401), whatever was sent", async () => {
  fake.users.clear();
  await expect(getAccountPreferences()).rejects.toEqual(
    refusedWith("profile_required"),
  );
  await expect(updateAccountPreferences(NO_INVOICES)).rejects.toEqual(
    refusedWith("profile_required"),
  );
  for (const response of [await getPreferences(), await put("not json")]) {
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("profile_required");
  }

  fake.claims = null;
  await expect(getAccountPreferences()).rejects.toEqual(
    refusedWith("unauthenticated"),
  );
  for (const response of [await getPreferences(), await put("not json")]) {
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
  }
});

// --- the profile (the real User row) ---------------------------------------------

test("updating the profile changes the signed-in person's own User row, and only the two names", async () => {
  expect(
    await updateProfile({ firstName: "Augusta", lastName: "King" }),
  ).toEqual({ ...ada, firstName: "Augusta", lastName: "King" });
  expect(fake.users.get(ada.id)).toEqual({
    ...ada,
    firstName: "Augusta",
    lastName: "King",
  });
  expect(fake.users.get(grace.id)).toEqual(grace);
});

test("PATCH /api/profile saves trimmed names, and GET /api/me then returns them", async () => {
  const response = await patch({ firstName: "  Augusta ", lastName: "King" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ...ada,
    firstName: "Augusta",
    lastName: "King",
  });
  expect(await (await getMeRoute()).json()).toMatchObject({
    firstName: "Augusta",
    lastName: "King",
    email: "ada@example.com",
  });
});

test.each([
  ["an empty name", { firstName: " ", lastName: "King" }],
  ["a missing name", { firstName: "Augusta" }],
  [
    "an email",
    { firstName: "Augusta", lastName: "King", email: "eve@example.com" },
  ],
  ["an id", { firstName: "Augusta", lastName: "King", id: "auth-user-2" }],
  ["a body that is not JSON", "not json"],
])("PATCH /api/profile rejects %s and changes nothing", async (_case, body) => {
  const response = await patch(body);
  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe("invalid_input");
  expect(fake.users.get(ada.id)).toEqual(ada);
  expect(fake.users.get(grace.id)).toEqual(grace);
});

test("PATCH /api/profile refuses a caller with no profile (403) and a signed-out caller (401)", async () => {
  fake.users.delete(ada.id);
  const noProfile = await patch({ firstName: "Augusta", lastName: "King" });
  expect(noProfile.status).toBe(403);
  expect((await noProfile.json()).error.code).toBe("profile_required");
  expect(fake.users.has(ada.id)).toBe(false);

  fake.claims = null;
  const signedOut = await patch({ firstName: "Augusta", lastName: "King" });
  expect(signedOut.status).toBe(401);
  await expect(
    updateProfile({ firstName: "Augusta", lastName: "King" }),
  ).rejects.toEqual(refusedWith("unauthenticated"));
});
