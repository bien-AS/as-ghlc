// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DELETE as deleteDomainRoute } from "@/app/api/workspace/domains/[domain]/route";
import { POST as postDomainRoute } from "@/app/api/workspace/domains/route";
import {
  GET as getWorkspaceRoute,
  PUT as putWorkspaceRoute,
} from "@/app/api/workspace/route";
import { buildSampleWorkspace } from "@/lib/data/fixtures/workspace";
import { resetSampleData } from "@/lib/data/sample";
import { PREVIEW_ROLE_COOKIE } from "@/lib/data/viewer";
import {
  addAllowedDomain,
  getWorkspace,
  removeAllowedDomain,
  updateWorkspace,
} from "@/lib/data/workspace";
import {
  JOIN_RULE,
  joinRuleText,
  ONE_SHARED_APP_WORKSPACE_PER_CUSTOMER,
  WORKSPACE_SELF_SERVE,
} from "@/lib/workspace/rules";
import { workspaceSchema } from "@/lib/workspace/schemas";
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

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-10-07T12:00:00.000Z"),
  });
  resetFakes();
  resetSampleData();
  signIn();
  fake.users.set(ada.id, ada);
});
afterEach(() => vi.useRealTimers());

const viewAs = (role: string) => fake.cookies.set(PREVIEW_ROLE_COOKIE, role);
const refusedWith = (code: string) => expect.objectContaining({ code });

const request = (path: string, method: string, body?: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });

const VALID_UPDATE = {
  name: "Northwind Sales",
  displayName: "Northwind",
  logoInitials: "NW",
};

const api = {
  get: () => getWorkspaceRoute(),
  put: (body: unknown = VALID_UPDATE) =>
    putWorkspaceRoute(request("/api/workspace", "PUT", body)),
  addDomain: (body: unknown = { domain: "northwind.example" }) =>
    postDomainRoute(request("/api/workspace/domains", "POST", body)),
  removeDomain: (domain = "authoritysolutions.com") =>
    deleteDomainRoute(request(`/api/workspace/domains/${domain}`, "DELETE"), {
      params: Promise.resolve({ domain }),
    }),
};
/** Every route of the resource, each with a request that would succeed. */
const EVERY_ROUTE = Object.entries(api) as [string, () => Promise<Response>][];
/** Every data-access function, each with input that would succeed. */
const EVERY_FUNCTION: [string, () => Promise<unknown>][] = [
  ["getWorkspace", () => getWorkspace()],
  ["updateWorkspace", () => updateWorkspace(VALID_UPDATE)],
  ["addAllowedDomain", () => addAllowedDomain({ domain: "new.example" })],
  [
    "removeAllowedDomain",
    () => removeAllowedDomain({ domain: "authoritysolutions.com" }),
  ],
];

const code = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;
const fields = async (response: Response) =>
  Object.keys(
    ((await response.json()) as { error: { fields: object } }).error.fields,
  );

// --- the fixture and the assumptions -----------------------------------------

test("the sample Workspace parses against the contract and is the one spec 12 names", async () => {
  const fixture = buildSampleWorkspace();
  expect(workspaceSchema.parse(fixture)).toEqual(fixture);
  expect(await getWorkspace()).toEqual({
    id: "workspace-sample",
    name: "Authority Solutions",
    branding: { displayName: "Authority Solutions", logoInitials: "AS" },
    allowedDomains: ["authoritysolutions.com"],
  });
});

test("the assumed answers: a shared app (question 9), no self-serve Workspace (spec 12), domain OR invite (question 7)", () => {
  expect(ONE_SHARED_APP_WORKSPACE_PER_CUSTOMER).toBe(true);
  expect(WORKSPACE_SELF_SERVE).toBe(false);
  expect(JOIN_RULE).toBe("domain_or_invite");
  expect(joinRuleText()).toMatch(/allowed domain, or who have an invite/);
});

// --- the guards ----------------------------------------------------------------

test.each(EVERY_ROUTE)(
  "%s: signed out is 401, no profile is 403 profile_required, staff is 403 forbidden",
  async (_name, call) => {
    viewAs("staff");
    const asStaff = await call();
    expect(asStaff.status).toBe(403);
    expect(await code(asStaff)).toBe("forbidden");

    viewAs("owner");
    fake.users.clear();
    const noProfile = await call();
    expect(noProfile.status).toBe(403);
    expect(await code(noProfile)).toBe("profile_required");

    fake.claims = null;
    const signedOut = await call();
    expect(signedOut.status).toBe(401);
    expect(await code(signedOut)).toBe("unauthenticated");

    // Nothing a refused caller sent was applied.
    signIn();
    fake.users.set(ada.id, ada);
    expect(await getWorkspace()).toEqual(buildSampleWorkspace());
  },
);

test.each(EVERY_ROUTE)(
  "%s: admin and owner are allowed",
  async (_name, call) => {
    viewAs("admin");
    expect((await call()).status).toBe(200);
    resetSampleData();
    viewAs("owner");
    expect((await call()).status).toBe(200);
  },
);

test.each(EVERY_FUNCTION)(
  "%s refuses staff, a caller without a profile and a signed-out caller, and allows an admin",
  async (_name, call) => {
    viewAs("staff");
    await expect(call()).rejects.toEqual(refusedWith("forbidden"));
    viewAs("admin");
    await expect(call()).resolves.toBeDefined();

    fake.users.clear();
    await expect(call()).rejects.toEqual(refusedWith("profile_required"));
    fake.claims = null;
    await expect(call()).rejects.toEqual(refusedWith("unauthenticated"));
  },
);

test("a refusal comes before validation: staff sending nonsense get 403, not 400", async () => {
  viewAs("staff");
  expect((await api.put({ nonsense: true })).status).toBe(403);
  expect((await api.addDomain("not json")).status).toBe(403);
  expect((await api.removeDomain("not a domain")).status).toBe(403);
});

// --- name and branding ---------------------------------------------------------

test("a saved name and branding show in a later read, trimmed, with the initials in upper case", async () => {
  const response = await api.put({
    name: "  Northwind Sales ",
    displayName: " Northwind ",
    logoInitials: "nw",
  });
  expect(response.status).toBe(200);
  const saved = workspaceSchema.parse(await response.json());
  expect(saved).toMatchObject({
    name: "Northwind Sales",
    branding: { displayName: "Northwind", logoInitials: "NW" },
  });
  expect(await getWorkspace()).toEqual(saved);
  // The domains are not part of this write.
  expect(saved.allowedDomains).toEqual(["authoritysolutions.com"]);
});

test("an invalid update is a 400 naming the fields, and changes nothing", async () => {
  const empty = await api.put({ name: " ", displayName: "", logoInitials: "" });
  expect(empty.status).toBe(400);
  expect(await fields(empty)).toEqual(["name", "displayName", "logoInitials"]);

  expect(
    await fields(await api.put({ ...VALID_UPDATE, logoInitials: "ABCD" })),
  ).toEqual(["logoInitials"]);
  expect(
    await fields(await api.put({ ...VALID_UPDATE, logoInitials: "A-" })),
  ).toEqual(["logoInitials"]);
  expect(
    await fields(await api.put({ ...VALID_UPDATE, name: "x".repeat(101) })),
  ).toEqual(["name"]);

  // Only the three fields are accepted: the id and the domains cannot be set here.
  expect(
    (await api.put({ ...VALID_UPDATE, id: "other", allowedDomains: [] }))
      .status,
  ).toBe(400);
  expect((await api.put("not json")).status).toBe(400);

  expect(await getWorkspace()).toEqual(buildSampleWorkspace());
});

// --- allowed domains -----------------------------------------------------------

test("an added domain is normalised to lower case and shows in a later read; a duplicate is a conflict", async () => {
  const response = await api.addDomain({ domain: "  Northwind.Example " });
  expect(response.status).toBe(200);
  expect(workspaceSchema.parse(await response.json()).allowedDomains).toEqual([
    "authoritysolutions.com",
    "northwind.example",
  ]);
  expect((await getWorkspace()).allowedDomains).toContain("northwind.example");

  // The same domain in another case is the same domain.
  const again = await api.addDomain({ domain: "NORTHWIND.example" });
  expect(again.status).toBe(409);
  expect(await code(again)).toBe("conflict");
  await expect(
    addAllowedDomain({ domain: "authoritysolutions.com" }),
  ).rejects.toEqual(refusedWith("conflict"));
  expect((await getWorkspace()).allowedDomains).toHaveLength(2);
});

test.each([
  "",
  "northwind",
  "@northwind.example",
  "ada@northwind.example",
  "https://northwind.example",
  "north wind.example",
  "-northwind.example",
  "northwind..example",
  "northwind.example/",
])("%j is not a domain: 400 naming the field", async (domain) => {
  const response = await api.addDomain({ domain });
  expect(response.status).toBe(400);
  expect(await fields(response)).toEqual(["domain"]);
  expect((await getWorkspace()).allowedDomains).toEqual([
    "authoritysolutions.com",
  ]);
});

test("a removed domain is gone from a later read; an unknown one is not found; a malformed one is invalid", async () => {
  const unknown = await api.removeDomain("northwind.example");
  expect(unknown.status).toBe(404);
  expect(await code(unknown)).toBe("not_found");
  expect((await api.removeDomain("not a domain")).status).toBe(400);

  const response = await api.removeDomain("AuthoritySolutions.com");
  expect(response.status).toBe(200);
  expect(workspaceSchema.parse(await response.json()).allowedDomains).toEqual(
    [],
  );
  // The last domain can go: the Workspace is then joined by invite only.
  expect((await getWorkspace()).allowedDomains).toEqual([]);
  expect((await api.removeDomain()).status).toBe(404);
});

test("what a caller is given is a copy: changing it does not change the store", async () => {
  const given = await getWorkspace();
  given.name = "Changed";
  given.allowedDomains.push("sneaky.example");
  given.branding.logoInitials = "XX";
  expect(await getWorkspace()).toEqual(buildSampleWorkspace());
});
