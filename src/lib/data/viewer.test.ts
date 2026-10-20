// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET as getViewerRoute } from "@/app/api/viewer/route";
import {
  getLead,
  recordDeckTemplate,
  recordInvoiceDraft,
  recordProposalStatus,
} from "@/lib/data/leads";
import { resetSampleData } from "@/lib/data/sample";
import {
  leadScope,
  type Profile,
  requireAdmin,
  requireProfile,
} from "@/lib/data/users";
import { getViewerSummary } from "@/lib/data/viewer";
import { viewerSchema } from "@/lib/roles";
import {
  fake,
  resetFakes,
  SAMPLE_REP,
  signIn,
  viewAs,
} from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);

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

const refusedWith = (code: string) => expect.objectContaining({ code });

// --- the guards (spec 01 section 4) --------------------------------------------

test("requireProfile: signed out is 401, no profile is 403, a deactivated profile is 403, else the profile", async () => {
  expect(await requireProfile()).toEqual({
    ...ada,
    role: "admin",
    active: true,
  });

  fake.users.set(ada.id, { ...ada, active: false });
  await expect(requireProfile()).rejects.toEqual(refusedWith("forbidden"));
  fake.users.clear();
  await expect(requireProfile()).rejects.toEqual(
    refusedWith("profile_required"),
  );
  fake.claims = null;
  await expect(requireProfile()).rejects.toEqual(
    refusedWith("unauthenticated"),
  );
});

test("requireAdmin: an admin passes, a rep is refused, and a deactivated admin is refused", async () => {
  expect((await requireAdmin()).role).toBe("admin");
  viewAs("rep");
  await expect(requireAdmin()).rejects.toEqual(refusedWith("forbidden"));
  viewAs("admin");
  fake.users.set(ada.id, { ...ada, active: false });
  await expect(requireAdmin()).rejects.toEqual(refusedWith("forbidden"));
});

test("leadScope: an admin reaches every lead (no condition), a rep only the leads assigned to them", () => {
  const profile = (role: Profile["role"]): Profile => ({
    ...ada,
    role,
    active: true,
  });
  expect(leadScope(profile("admin"))).toBeUndefined();
  const scope = leadScope(profile("rep"));
  expect(scope && new PgDialect().sqlToQuery(scope)).toMatchObject({
    sql: '"leads"."assigned_to" = $1',
    params: [ada.id],
  });
});

test("the viewer summary carries the profile's own role, admin or rep", async () => {
  // Leads are real (spec 07): the sample-only controls are off.
  expect(await getViewerSummary()).toEqual({ role: "admin", preview: false });
  viewAs("rep");
  expect(await getViewerSummary()).toEqual({ role: "rep", preview: false });
});

// --- what a role sees of the leads ---------------------------------------------

/*
 * Leads are rows in Postgres now (spec 07): which rows a role reaches is
 * proven on a real database by src/test/isolation and leads.db.test.ts. Here,
 * what is settled before a query: the session decides the scope.
 */

test("the signed-in rep's scope is the leads assigned to them; the signed-in admin's is every lead", async () => {
  expect(leadScope(await requireProfile())).toBeUndefined();

  viewAs("rep");
  const scope = leadScope(await requireProfile());
  expect(scope && new PgDialect().sqlToQuery(scope)).toMatchObject({
    sql: '"leads"."assigned_to" = $1',
    params: [SAMPLE_REP.id],
  });
});

test("an id that names no lead is not found, for either role, before anything is read", async () => {
  for (const role of ["admin", "rep"] as const) {
    viewAs(role);
    await expect(getLead("lead-01")).rejects.toEqual(refusedWith("not_found"));
  }
});

// --- the viewer route ---------------------------------------------------------------

test("GET /api/viewer answers with the role, and 401 when signed out", async () => {
  const response = await getViewerRoute();
  expect(viewerSchema.parse(await response.json()).role).toBe("admin");

  fake.claims = null;
  expect((await getViewerRoute()).status).toBe(401);
});

// --- what the other blocks record on a lead ----------------------------------------

/*
 * The proposal, invoice and deck mockups recorded their changes on a sample
 * lead. A real lead has none of those yet, so each recording is refused after
 * the guard until specs 09, 12 and 13 write their own tables.
 */

test("recording a proposal status or an invoice draft is guarded, then refused for a lead that is not found", async () => {
  fake.claims = null;
  await expect(recordProposalStatus("lead-01", "sent")).rejects.toEqual(
    refusedWith("unauthenticated"),
  );
  signIn();
  await expect(recordProposalStatus("lead-01", "sent")).rejects.toEqual(
    refusedWith("not_found"),
  );
  await expect(recordInvoiceDraft("lead-01")).rejects.toEqual(
    refusedWith("not_found"),
  );
});

test("recording a deck template is guarded, then refused for a lead that is not found", async () => {
  fake.users.clear();
  await expect(recordDeckTemplate("lead-01", "Review")).rejects.toEqual(
    refusedWith("profile_required"),
  );
  fake.users.set(ada.id, ada);
  await expect(recordDeckTemplate("lead-01", "Review")).rejects.toEqual(
    refusedWith("not_found"),
  );
});
