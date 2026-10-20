// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

import {
  archiveLead,
  assignRep,
  changeStatus,
  getLead,
  getPipelineSummary,
  listLeads,
  listVisibleLeads,
  markSpam,
  REP_SETTABLE_STATUSES,
  reviewSuspect,
  setQualification,
} from "@/lib/data/leads";
import {
  type ListLeadsQuery,
  listLeadsQuerySchema,
  parseLeadFilters,
} from "@/lib/leads/schemas";
import { fake, resetFakes, signIn, viewAs } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);

/*
 * The leads module reads the synced `leads` table (spec 07). What it returns
 * is proven on a real database in leads.db.test.ts and the isolation suite;
 * here, without one, only what is settled before any row is read: the guard
 * comes first, and the address and the query parse the way the list needs.
 */

const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};
const LEAD = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  resetFakes();
  signIn();
  fake.users.set(ada.id, ada);
});
const query = (input: Record<string, string> = {}): ListLeadsQuery =>
  listLeadsQuerySchema.parse(input);

const everyFunction = (): [string, () => Promise<unknown>][] => [
  ["listLeads", () => listLeads(query())],
  ["getPipelineSummary", () => getPipelineSummary({ tz: "UTC" })],
  ["getLead", () => getLead(LEAD)],
  ["listVisibleLeads", () => listVisibleLeads()],
  ["reviewSuspect", () => reviewSuspect(LEAD, { outcome: "cleared" })],
  ["setQualification", () => setQualification(LEAD, { decision: "qualified" })],
  ["markSpam", () => markSpam(LEAD)],
  ["changeStatus", () => changeStatus(LEAD, { status: "New - Contacted" })],
  ["assignRep", () => assignRep(LEAD, { profileId: null })],
  ["archiveLead", () => archiveLead(LEAD, {})],
];

test("signed out, every function refuses before reading or changing a lead", async () => {
  fake.claims = null;
  for (const [name, call] of everyFunction()) {
    await expect(call(), name).rejects.toMatchObject({
      code: "unauthenticated",
    });
  }
});

test("signed in without a profile, every function refuses as profile required", async () => {
  fake.users.clear();
  for (const [name, call] of everyFunction()) {
    await expect(call(), name).rejects.toMatchObject({
      code: "profile_required",
    });
  }
});

test("Assign rep is an admin's: a rep is refused before the lead is looked up", async () => {
  viewAs("rep");
  await expect(assignRep(LEAD, { profileId: null })).rejects.toMatchObject({
    code: "forbidden",
  });
});

test("until question 2 is answered, a rep may set no Lead Status by hand", () => {
  expect(REP_SETTABLE_STATUSES).toEqual([]);
});

test("the list query: open, newest first and active leads by default; archived, sort and owner come from the address", () => {
  expect(query()).toMatchObject({
    tab: "open",
    archived: false,
    sort: "recent",
    dir: "desc",
    limit: 25,
  });
  expect(
    query({ archived: "true", sort: "age", dir: "asc", owner: "unassigned" }),
  ).toMatchObject({
    archived: true,
    sort: "age",
    dir: "asc",
    owner: "unassigned",
  });
  expect(() => query({ sort: "oldest" })).toThrow();
  expect(() => query({ workspace: "another" })).toThrow();
});

test("the address is read leniently: an unknown value in a pasted link is no filter, and unset filters leave no key", () => {
  expect(parseLeadFilters({}, "UTC")).toEqual({ tab: "open", tz: "UTC" });
  expect(
    parseLeadFilters(
      {
        tab: "archived",
        verdict: "maybe",
        sort: "oldest",
        archived: "yes",
        group: "  Qualified ",
        owner: "",
      },
      "Europe/London",
    ),
  ).toEqual({ tab: "open", group: "Qualified", tz: "Europe/London" });
  expect(
    parseLeadFilters({ tab: "lost", archived: "true", owner: "x" }, "Nowhere"),
  ).toEqual({ tab: "lost", archived: "true", owner: "x", tz: "UTC" });
});
