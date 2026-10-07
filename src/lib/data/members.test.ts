// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  DELETE as deleteMember,
  PATCH as patchMember,
} from "@/app/api/members/[memberId]/route";
import { POST as postResend } from "@/app/api/members/invites/[inviteId]/resend/route";
import { DELETE as deleteInvite } from "@/app/api/members/invites/[inviteId]/route";
import { POST as postInvite } from "@/app/api/members/invites/route";
import { GET as getMembers } from "@/app/api/members/route";
import { buildSampleMembers } from "@/lib/data/fixtures/members";
import { getPipelineSummary } from "@/lib/data/leads";
import {
  changeMemberRole,
  inviteMember,
  listMembers,
  removeMember,
  resendInvite,
  revokeInvite,
} from "@/lib/data/members";
import { resetSampleData } from "@/lib/data/sample";
import { PREVIEW_ROLE_COOKIE } from "@/lib/data/viewer";
import { inviteExpiresAt, memberLock } from "@/lib/members/rules";
import {
  INVITE_EXPIRES_AFTER_DAYS,
  type Member,
  memberListSchema,
  memberSchema,
} from "@/lib/members/schemas";
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
const NOW = new Date("2026-10-07T12:00:00.000Z");
const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  resetFakes();
  resetSampleData();
  signIn();
  fake.users.set(ada.id, ada);
});
afterEach(() => vi.useRealTimers());

const viewAs = (role: string) => fake.cookies.set(PREVIEW_ROLE_COOKIE, role);
const refusedWith = (code: string) => expect.objectContaining({ code });
const named = (members: Member[], who: string) => {
  const found = members.find(
    (member) => member.name === who || member.email === who,
  );
  if (!found) throw new Error(`nobody called ${who}`);
  return found;
};
const idOf = async (who: string) => named(await listMembers(), who).id;

const JONAS = "jonas.weber@northgate.example";

// --- the routes, called as the browser would -----------------------------------

const request = (method: string, body?: unknown) =>
  new Request(`${ORIGIN}/api/members`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const at = (name: string, id: string) => ({
  params: Promise.resolve({ [name]: id }) as Promise<never>,
});
const routes = {
  list: () => getMembers(),
  invite: (body: unknown = { email: "new@northgate.example", role: "staff" }) =>
    postInvite(request("POST", body)),
  role: (id: string, body: unknown = { role: "admin" }) =>
    patchMember(request("PATCH", body), at("memberId", id)),
  remove: (id: string) => deleteMember(request("DELETE"), at("memberId", id)),
  revoke: (id: string) => deleteInvite(request("DELETE"), at("inviteId", id)),
  resend: (id: string) => postResend(request("POST"), at("inviteId", id)),
};
/** One call to every route, against rows that exist. */
const everyRoute = (userId: string, inviteId: string) => [
  routes.list(),
  routes.invite(),
  routes.role(userId),
  routes.remove(userId),
  routes.revoke(inviteId),
  routes.resend(inviteId),
];
const listOf = async (response: Response) => {
  expect(response.status).toBe(200);
  return memberListSchema.parse(await response.json());
};
const codeOf = async (response: Response) =>
  (await response.json()).error.code as string;

// --- the sample people ---------------------------------------------------------

test("every sample person parses against the contract, is invented, and keeps the CRM user id on the server", async () => {
  const fixtures = buildSampleMembers(NOW.getTime());
  for (const record of fixtures) {
    expect(() =>
      memberSchema.parse({ ...record, isViewer: false }),
    ).not.toThrow();
    expect(record.email).toMatch(/\.example$/);
  }
  expect(fixtures.some((record) => record.externalCrmUserId)).toBe(true);

  const listed = await listMembers();
  expect(memberListSchema.parse(listed)).toEqual(listed);
  expect(JSON.stringify(listed)).not.toMatch(/crm/i);

  const roles = (role: string, status = "active") =>
    listed.filter(
      (member) =>
        !member.isViewer && member.role === role && member.status === status,
    ).length;
  expect([roles("owner"), roles("admin"), roles("staff")]).toEqual([1, 1, 4]);
  expect(listed.filter((member) => member.status === "invited")).toHaveLength(
    2,
  );
});

test("the sample Staff are exactly the reps on the sample leads", async () => {
  const { owners } = await getPipelineSummary({ tz: "UTC" });
  const staff = (await listMembers())
    .filter((member) => member.role === "staff" && member.status === "active")
    .map((member) => member.name);
  expect(staff.sort()).toEqual(owners.map((owner) => owner.name).sort());
});

test("the list starts with the viewer, marked as you with the previewed role, then users, then pending invites", async () => {
  for (const role of ["owner", "admin"] as const) {
    viewAs(role);
    const [you, ...others] = await listMembers();
    expect(you).toEqual({
      id: ada.id,
      name: "Ada Lovelace",
      email: ada.email,
      role,
      status: "active",
      isViewer: true,
      invitedAt: null,
    });
    expect(others.every((member) => !member.isViewer)).toBe(true);
    expect(others.map((member) => member.status)).toEqual([
      ...Array(6).fill("active"),
      "invited",
      "invited",
    ]);
    for (const member of others) {
      expect(member.name === null).toBe(member.status === "invited");
      expect(member.invitedAt === null).toBe(member.status === "active");
    }
  }
});

// --- who may ask ---------------------------------------------------------------

test("a staff caller gets 403 forbidden on every route, signed out 401, without a profile 403, and nothing changes", async () => {
  const before = await listMembers();
  const userId = named(before, "Maya Okafor").id;
  const inviteId = named(before, JONAS).id;

  viewAs("staff");
  for (const response of await Promise.all(everyRoute(userId, inviteId))) {
    expect(response.status).toBe(403);
    expect(await codeOf(response)).toBe("forbidden");
  }
  // Refused before the input is read: a bad body is still 403, not 400.
  expect((await routes.invite({ nonsense: true })).status).toBe(403);
  expect((await routes.role(userId, {})).status).toBe(403);
  for (const call of [
    listMembers(),
    inviteMember({ email: "x@northgate.example", role: "staff" }),
    changeMemberRole(userId, "admin"),
    removeMember(userId),
    revokeInvite(inviteId),
    resendInvite(inviteId),
  ]) {
    await expect(call).rejects.toEqual(refusedWith("forbidden"));
  }

  viewAs("owner");
  fake.users.clear();
  for (const response of await Promise.all(everyRoute(userId, inviteId))) {
    expect(response.status).toBe(403);
    expect(await codeOf(response)).toBe("profile_required");
  }
  fake.claims = null;
  for (const response of await Promise.all(everyRoute(userId, inviteId))) {
    expect(response.status).toBe(401);
  }

  signIn();
  fake.users.set(ada.id, ada);
  expect(await listMembers()).toEqual(before);
});

test.each(["admin", "owner"] as const)(
  "an %s can list, invite, change a role, remove, revoke and send again, and each write shows in a later read",
  async (role) => {
    viewAs(role);
    const before = await listOf(await routes.list());
    expect(before).toHaveLength(9);

    // Invite: the address is trimmed and lower-cased, and the invite is pending.
    const invited = await listOf(
      await routes.invite({
        email: "  New.Rep@Northgate.example ",
        role: "staff",
      }),
    );
    const invite = named(invited, "new.rep@northgate.example");
    expect(invite).toMatchObject({
      name: null,
      role: "staff",
      status: "invited",
      invitedAt: NOW.toISOString(),
    });
    expect(invited.at(-1)).toEqual(invite);

    // Change a role: a user's, and the role a pending invite will give.
    const maya = named(before, "Maya Okafor");
    await listOf(await routes.role(maya.id, { role: "admin" }));
    await listOf(await routes.role(invite.id, { role: "admin" }));
    let now = await listOf(await routes.list());
    expect(named(now, "Maya Okafor").role).toBe("admin");
    expect(named(now, invite.email).role).toBe("admin");

    // Send again: the sent time moves, and with it the expiry.
    const jonas = named(before, JONAS);
    expect(jonas.invitedAt).toBe("2026-10-05T12:00:00.000Z");
    vi.setSystemTime(new Date("2026-10-08T09:30:00.000Z"));
    await listOf(await routes.resend(jonas.id));
    now = await listOf(await routes.list());
    expect(named(now, JONAS).invitedAt).toBe("2026-10-08T09:30:00.000Z");

    // Remove and revoke: gone from the next read, and gone for good.
    await listOf(await routes.remove(maya.id));
    await listOf(await routes.revoke(jonas.id));
    now = await listOf(await routes.list());
    expect(now.map((member) => member.id)).not.toContain(maya.id);
    expect(now.map((member) => member.id)).not.toContain(jonas.id);
    expect(now).toHaveLength(8);
    expect((await routes.remove(maya.id)).status).toBe(404);
    expect((await routes.resend(jonas.id)).status).toBe(404);
  },
);

// --- what is refused -----------------------------------------------------------

test("an invite needs a valid address and a role; an address that already has access or an invite is a conflict", async () => {
  for (const bad of [
    { email: "", role: "staff" },
    { email: "not-an-address", role: "staff" },
    { email: "a@northgate.example", role: "root" },
    { email: "a@northgate.example" },
    { email: "a@northgate.example", role: "staff", extra: 1 },
    null,
  ]) {
    const response = await routes.invite(bad);
    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe("invalid_input");
  }
  const noEmail = await routes.invite({ email: "nope", role: "staff" });
  expect((await noEmail.json()).error.fields.email).toEqual([
    "Enter a valid email address, like name@example.com.",
  ]);
  expect(
    (await routes.role(await idOf("Maya Okafor"), { role: "x" })).status,
  ).toBe(400);

  for (const taken of [
    "maya.okafor@northgate.example", // a user
    "Maya.Okafor@Northgate.Example", // the same, typed differently
    JONAS, // a pending invite
    ada.email, // the viewer
  ]) {
    const response = await routes.invite({ email: taken, role: "staff" });
    expect(response.status).toBe(409);
    expect(await codeOf(response)).toBe("conflict");
  }
  expect(await listMembers()).toHaveLength(9);
});

test("an unknown id is not found, and a user's routes do not act on an invite or an invite's on a user", async () => {
  const maya = await idOf("Maya Okafor");
  const jonas = await idOf(JONAS);

  for (const response of [
    await routes.role("user-nobody"),
    await routes.remove("user-nobody"),
    await routes.revoke("invite-nobody"),
    await routes.resend("invite-nobody"),
    await routes.remove(jonas),
    await routes.revoke(maya),
    await routes.resend(maya),
  ]) {
    expect(response.status).toBe(404);
    expect(await codeOf(response)).toBe("not_found");
  }
  expect(await listMembers()).toHaveLength(9);
});

test("you cannot remove yourself or change your own role here", async () => {
  for (const role of ["admin", "owner"] as const) {
    viewAs(role);
    expect((await routes.role(ada.id, { role: "staff" })).status).toBe(409);
    expect((await routes.remove(ada.id)).status).toBe(409);
    await expect(changeMemberRole(ada.id, "staff")).rejects.toEqual(
      refusedWith("conflict"),
    );
    const [you, ...others] = await listMembers();
    expect(you.role).toBe(role);
    expect(memberLock([you, ...others], you)).toBe("self");
  }
});

test("the last owner cannot be removed or demoted; with a second owner, either can be", async () => {
  // Seen as an Admin, the sample Owner is the only owner.
  viewAs("admin");
  let people = await listMembers();
  const helena = named(people, "Helena Brandt");
  expect(memberLock(people, helena)).toBe("last_owner");
  expect(memberLock(people, named(people, "Samir Haddad"))).toBeNull();

  for (const response of [
    await routes.role(helena.id, { role: "admin" }),
    await routes.remove(helena.id),
  ]) {
    expect(response.status).toBe(409);
    expect(await codeOf(response)).toBe("conflict");
  }
  expect(named(await listMembers(), "Helena Brandt").role).toBe("owner");
  // Keeping the role is not a demotion.
  expect((await routes.role(helena.id, { role: "owner" })).status).toBe(200);

  // An invited owner has not joined, so does not count.
  await inviteMember({ email: "second@northgate.example", role: "owner" });
  expect((await routes.remove(helena.id)).status).toBe(409);

  // A second owner who has joined frees the first.
  const samir = named(people, "Samir Haddad");
  await changeMemberRole(samir.id, "owner");
  people = await listMembers();
  expect(memberLock(people, named(people, "Helena Brandt"))).toBeNull();
  expect((await routes.remove(helena.id)).status).toBe(200);

  // And now Samir is the last one.
  people = await listMembers();
  expect(memberLock(people, named(people, "Samir Haddad"))).toBe("last_owner");
  await expect(changeMemberRole(samir.id, "staff")).rejects.toEqual(
    refusedWith("conflict"),
  );

  // Seen as an Owner, the viewer is an owner too, so Samir can be changed.
  viewAs("owner");
  expect((await changeMemberRole(samir.id, "staff")).length).toBeGreaterThan(0);
});

test("an invite expires a fixed number of days after it was last sent (mock choice)", () => {
  expect(INVITE_EXPIRES_AFTER_DAYS).toBe(7);
  expect(inviteExpiresAt("2026-10-05T12:00:00.000Z")).toBe(
    "2026-10-12T12:00:00.000Z",
  );
});
