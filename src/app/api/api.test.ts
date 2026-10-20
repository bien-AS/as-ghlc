// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

import { POST as postGhlImport } from "@/app/api/admin/ghl/import/route";
import { GET as getLeads } from "@/app/api/leads/route";
import { GET as getMe } from "@/app/api/me/route";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);

beforeEach(resetFakes);

const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

test("GET /api/me signed out: 401", async () => {
  const response = await getMe();
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: { code: "unauthenticated" } });
});

test("GET /api/me with a profile: the User", async () => {
  signIn();
  fake.users.set(ada.id, ada);
  const response = await getMe();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(ada);
});

// Spec 01 acceptance check 6: a session Google gave to someone the app has
// not provisioned, or has turned off, reaches no /api route.
const apiRoutes = {
  "GET /api/me": () => getMe(),
  "GET /api/leads": () =>
    getLeads(new Request("http://localhost:3000/api/leads")),
  "POST /api/admin/ghl/import": () =>
    postGhlImport(
      new Request("http://localhost:3000/api/admin/ghl/import", {
        method: "POST",
        body: "{}",
      }),
    ),
};

test.each(Object.entries(apiRoutes))(
  "%s signed in but unprovisioned: 403 profile_required",
  async (_name, call) => {
    signIn();
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "profile_required" },
    });
  },
);

test.each(Object.entries(apiRoutes))(
  "%s signed in but deactivated: 403 forbidden",
  async (_name, call) => {
    signIn();
    fake.users.set(ada.id, { ...ada, active: false });
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "forbidden" } });
  },
);
