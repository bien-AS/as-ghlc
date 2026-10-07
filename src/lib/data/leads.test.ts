// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { buildSampleLeads } from "@/lib/data/fixtures/leads";
import {
  getLead,
  getPipelineSummary,
  listLeads,
  markLost,
  markSpam,
  resetSampleLeads,
  reviewSuspect,
  setQualification,
} from "@/lib/data/leads";
import {
  EXITS,
  type LeadListItem,
  type ListLeadsQuery,
  leadDetailSchema,
  listLeadsQuerySchema,
  NEEDS,
  pipelineSummarySchema,
  STAGES,
  STATUSES,
  VERDICTS,
} from "@/lib/leads/schemas";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);

/*
 * Through the public functions only: what goes in, what comes out. These must
 * still pass when the bodies query a database instead of the fixtures.
 */

// Noon, so "today" is the same day in UTC whichever machine runs this.
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
  resetSampleLeads();
  signIn();
  fake.users.set(ada.id, ada);
});
afterEach(() => vi.useRealTimers());

const query = (input: Record<string, string> = {}): ListLeadsQuery =>
  listLeadsQuerySchema.parse({ limit: "100", ...input });
const list = async (input?: Record<string, string>) =>
  (await listLeads(query(input))).items;
const all = async (): Promise<LeadListItem[]> => [
  ...(await list()),
  ...(await list({ tab: "spam" })),
  ...(await list({ tab: "nurture" })),
  ...(await list({ tab: "lost" })),
];
const summary = () => getPipelineSummary({ tz: "UTC" });

/** The first lead in a tab that offers what the test needs. */
async function findLead(
  input: Record<string, string>,
  where: (lead: Awaited<ReturnType<typeof getLead>>) => boolean,
) {
  for (const item of await list(input)) {
    const lead = await getLead(item.id);
    if (where(lead)) return lead;
  }
  throw new Error("no sample lead matches");
}

// --- the contract and the sample data --------------------------------------

test("every sample lead parses against the contract, and uses only reserved domains and numbers", () => {
  const records = buildSampleLeads(NOW.getTime());
  expect(records.length).toBeGreaterThanOrEqual(40);
  for (const record of records) {
    // The stored record plus the two derived fields is a lead in detail.
    leadDetailSchema.parse({ ...record, verdict: "valid", nextBooking: null });
    if (record.email) expect(record.email).toMatch(/@[a-z0-9]+\.example$/);
    if (record.website) expect(record.website).toMatch(/\.example$/);
    if (record.phone) expect(record.phone).toMatch(/^\(555\) 555-01\d\d$/);
    for (const activity of record.activities) {
      // A CRM actor is called "CRM", never by a product name.
      if (activity.actor.kind === "crm")
        expect(activity.actor.name).toBe("CRM");
    }
  }
  expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
});

test("what the functions return parses against the contract", async () => {
  for (const item of await all()) {
    leadDetailSchema.parse(await getLead(item.id));
  }
  pipelineSummarySchema.parse(await summary());
});

test("the sample covers every stage, exit, verdict, status and needs-you category at least twice", async () => {
  const leads = await all();
  const count = (pick: (lead: LeadListItem) => unknown, value: unknown) =>
    leads.filter((lead) => pick(lead) === value).length;

  for (const stage of STAGES) {
    expect(
      leads.filter((lead) => !lead.exit && lead.stage === stage).length,
      stage,
    ).toBeGreaterThanOrEqual(2);
  }
  for (const exit of EXITS) {
    expect(
      count((lead) => lead.exit, exit),
      exit,
    ).toBeGreaterThanOrEqual(2);
  }
  for (const verdict of VERDICTS) {
    expect(
      count((lead) => lead.verdict, verdict),
      verdict,
    ).toBeGreaterThanOrEqual(2);
  }
  for (const status of STATUSES) {
    expect(
      count((lead) => lead.status, status),
      status,
    ).toBeGreaterThanOrEqual(2);
  }
  const { needs } = await summary();
  for (const need of NEEDS) expect(needs[need], need).toBeGreaterThanOrEqual(2);
  expect(needs.suspects).toBeGreaterThanOrEqual(6);
  // The edge cases the specs call out.
  expect(leads.some((lead) => lead.name.length > 30)).toBe(true);
  expect(leads.some((lead) => lead.company === null)).toBe(true);
  expect(leads.some((lead) => lead.email === null)).toBe(true);
  expect(leads.some((lead) => lead.nextBooking === null)).toBe(true);
});

// --- the guard --------------------------------------------------------------

const everyFunction = (): [string, () => Promise<unknown>][] => [
  ["listLeads", () => listLeads(query())],
  ["getPipelineSummary", summary],
  ["getLead", () => getLead("lead-01")],
  ["reviewSuspect", () => reviewSuspect("lead-03", { outcome: "cleared" })],
  [
    "setQualification",
    () => setQualification("lead-23", { decision: "qualified" }),
  ],
  ["markLost", () => markLost("lead-09", {})],
  ["markSpam", () => markSpam("lead-09")],
];

test("signed out, every function refuses before returning or changing anything", async () => {
  const before = JSON.stringify(await getLead("lead-09"));
  fake.claims = null;
  for (const [name, call] of everyFunction()) {
    await expect(call(), name).rejects.toMatchObject({
      code: "unauthenticated",
    });
  }
  signIn();
  expect(JSON.stringify(await getLead("lead-09"))).toBe(before);
});

test("signed in without a profile, every function refuses as profile required", async () => {
  fake.users.clear();
  for (const [name, call] of everyFunction()) {
    await expect(call(), name).rejects.toMatchObject({
      code: "profile_required",
    });
  }
});

// --- reading ----------------------------------------------------------------

test("the tabs: All open is every lead still in the pipeline, each stage and exit holds only its own", async () => {
  const counts = await summary();
  const open = await list();
  expect(open.every((lead) => lead.exit === null)).toBe(true);
  expect(open).toHaveLength(counts.open);
  expect(STAGES.reduce((sum, stage) => sum + counts.stages[stage], 0)).toBe(
    counts.open,
  );

  for (const stage of STAGES) {
    const leads = await list({ tab: stage });
    expect(leads).toHaveLength(counts.stages[stage]);
    expect(leads.every((lead) => lead.stage === stage && !lead.exit)).toBe(
      true,
    );
  }
  for (const exit of EXITS) {
    const leads = await list({ tab: exit });
    expect(leads).toHaveLength(counts.exits[exit]);
    expect(leads.every((lead) => lead.exit === exit)).toBe(true);
  }
});

test("search matches the name, the company or the email, ignoring case", async () => {
  expect((await list({ q: "sofia lind" })).map((lead) => lead.name)).toEqual([
    "Sofia Lindgren",
  ]);
  expect((await list({ q: "BELLWEATHER ROOF" }))[0]?.name).toBe(
    "Marcus Bellweather",
  );
  expect((await list({ q: "aiko@tanabe" }))[0]?.name).toBe("Aiko Tanabe");
  expect(await list({ q: "no such lead anywhere" })).toEqual([]);
});

test("the verdict and rep filters narrow the list, and combine with search and tab", async () => {
  const suspects = await list({ verdict: "suspect" });
  expect(suspects.length).toBeGreaterThan(0);
  expect(suspects.every((lead) => lead.verdict === "suspect")).toBe(true);

  const awaiting = await list({ verdict: "awaiting" });
  expect(awaiting.every((lead) => lead.status === "awaiting_verdict")).toBe(
    true,
  );

  const { owners } = await summary();
  expect(owners.length).toBeGreaterThanOrEqual(3);
  const [rep] = owners;
  const theirs = await list({ owner: rep.id });
  expect(theirs.length).toBeGreaterThan(0);
  expect(theirs.every((lead) => lead.owner.id === rep.id)).toBe(true);

  const combined = await list({ tab: "new", verdict: "valid", owner: rep.id });
  expect(combined.length).toBeGreaterThan(0);
  expect(combined.length).toBeLessThan(theirs.length);
  expect(
    combined.every(
      (lead) =>
        lead.stage === "new" &&
        lead.verdict === "valid" &&
        lead.owner.id === rep.id,
    ),
  ).toBe(true);
  expect(await list({ tab: "won", verdict: "suspect" })).toEqual([]);
});

test("a cleared suspect is listed and filtered as valid, a rejected one as spam", async () => {
  const valid = await list({ verdict: "valid", q: "Odette" });
  expect(valid.map((lead) => lead.name)).toEqual(["Odette Blackwood"]);
  const spam = await list({ tab: "spam", verdict: "spam", q: "Wendell" });
  expect(spam.map((lead) => lead.name)).toEqual(["Wendell Krause"]);
});

test("each needs-you count equals the leads its filter lists, by the definitions in spec 05", async () => {
  const { needs } = await summary();
  for (const need of NEEDS) {
    expect(await list({ needs: need }), need).toHaveLength(needs[need]);
  }

  for (const lead of await list({ needs: "suspects" })) {
    expect(lead.verdict).toBe("suspect");
  }
  for (const lead of await list({ needs: "calls_today" })) {
    expect(lead.nextBooking?.state).toBe("confirmed");
    expect(lead.nextBooking?.time.slice(0, 10)).toBe("2026-10-07");
  }
  for (const item of await list({ needs: "proposals" })) {
    const lead = await getLead(item.id);
    expect(["qualified", "review_booked"]).toContain(lead.stage);
    expect([undefined, "draft"]).toContain(lead.proposal?.status);
  }
  for (const item of await list({ needs: "invoices" })) {
    const lead = await getLead(item.id);
    expect(lead.stage).toBe("won");
    expect(lead.invoice?.status).toBe("draft");
  }
});

test("calls today follows the viewer's day, not the server's", async () => {
  const names = async (tz: string) =>
    (await list({ needs: "calls_today", tz })).map((lead) => lead.name);
  // Rex Thornbury's call is at 17:00 UTC on the 7th, and it is noon UTC.
  expect(await names("UTC")).toContain("Rex Thornbury");

  // Fifteen hours later it is 03:00 UTC on the 8th: the call was yesterday in
  // UTC. In Honolulu it is still 17:00 on the 7th, and the call was at 07:00
  // that same day.
  vi.setSystemTime(new Date("2026-10-08T03:00:00.000Z"));
  expect(await names("UTC")).not.toContain("Rex Thornbury");
  expect(await names("Pacific/Honolulu")).toContain("Rex Thornbury");
  expect(
    (await getPipelineSummary({ tz: "Pacific/Honolulu" })).needs.calls_today,
  ).toBeGreaterThan(
    (await getPipelineSummary({ tz: "UTC" })).needs.calls_today,
  );
});

test("the suspect queue is oldest first", async () => {
  const queue = await list({ needs: "suspects" });
  const waitingSince = queue.map((lead) => lead.createdAt);
  expect(waitingSince).toEqual([...waitingSince].sort());
  expect(queue[0]?.name).toBe("Rex Thornbury");
});

test("paging walks the whole list without a duplicate or a gap", async () => {
  const everything = (await list()).map((lead) => lead.id);
  const seen: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const page = await listLeads(
      listLeadsQuerySchema.parse({ limit: "7", ...(cursor && { cursor }) }),
    );
    expect(page.total).toBe(everything.length);
    expect(page.items.length).toBeLessThanOrEqual(7);
    seen.push(...page.items.map((lead) => lead.id));
    cursor = page.nextCursor ?? undefined;
    pages += 1;
  } while (cursor);
  expect(pages).toBe(Math.ceil(everything.length / 7));
  expect(seen).toEqual(everything);
  // The default page is 25, and All open has more than one page of leads.
  const first = await listLeads(listLeadsQuerySchema.parse({}));
  expect(first.items).toHaveLength(25);
  expect(first.nextCursor).not.toBeNull();
});

test("an unknown lead is not found, for a read and for every write", async () => {
  for (const call of [
    () => getLead("lead-999"),
    () => reviewSuspect("lead-999", { outcome: "spam" }),
    () => setQualification("lead-999", { decision: "qualified" }),
    () => markLost("lead-999", {}),
    () => markSpam("lead-999"),
  ]) {
    await expect(call()).rejects.toMatchObject({ code: "not_found" });
  }
});

test("what a caller is given is a copy: changing it does not change the lead", async () => {
  const lead = await getLead("lead-09");
  lead.name = "Changed";
  lead.activities.length = 0;
  expect((await getLead("lead-09")).name).not.toBe("Changed");
  expect((await getLead("lead-09")).activities.length).toBeGreaterThan(0);
});

// --- writing ----------------------------------------------------------------

test("clearing a suspect: valid everywhere, booking untouched, reviewer and time from the session and the clock", async () => {
  const before = await findLead(
    { needs: "suspects" },
    (lead) => lead.nextBooking !== null,
  );
  const counts = await summary();

  const after = await reviewSuspect(before.id, { outcome: "cleared" });

  expect(after.verdict).toBe("valid");
  expect(after.verdictRecord).toMatchObject({
    result: "suspect", // what the AI said is kept
    reviewOutcome: "cleared",
    reviewedBy: "Ada Lovelace",
    reviewedAt: NOW.toISOString(),
  });
  expect(after.stage).toBe(before.stage);
  expect(after.exit).toBeNull();
  expect(after.bookings).toEqual(before.bookings);
  expect(after.status).toBe("needs_decision");
  expect(after.activities).toHaveLength(before.activities.length + 1);
  expect(after.activities[0]).toMatchObject({
    actor: { kind: "user", name: "Ada Lovelace" },
    detail: "Cleared as valid.",
    time: NOW.toISOString(),
  });

  // The write shows in later reads: the lead, the queue and the counts.
  expect(await getLead(before.id)).toEqual(after);
  expect(
    (await list({ needs: "suspects" })).map((lead) => lead.id),
  ).not.toContain(before.id);
  expect((await summary()).needs.suspects).toBe(counts.needs.suspects - 1);
  expect((await list({ verdict: "valid" })).map((lead) => lead.id)).toContain(
    before.id,
  );
});

test("clearing a suspect with no call booked gives it the status of a valid lead still to book", async () => {
  const before = await findLead(
    { needs: "suspects" },
    (lead) => lead.nextBooking === null,
  );
  const after = await reviewSuspect(before.id, { outcome: "cleared" });
  expect(after.status).toBe("drip_chasing");
});

test("rejecting a suspect: leaves through Spam, its upcoming call is cancelled", async () => {
  const before = await findLead(
    { needs: "suspects" },
    (lead) => lead.nextBooking !== null,
  );
  const counts = await summary();

  const after = await reviewSuspect(before.id, { outcome: "spam" });

  expect(after).toMatchObject({
    verdict: "spam",
    exit: "spam",
    status: "removed",
    stage: before.stage, // the stage it left from is kept
    nextBooking: null,
  });
  expect(after.verdictRecord).toMatchObject({
    result: "suspect",
    reviewOutcome: "spam",
    reviewedBy: "Ada Lovelace",
  });
  expect(after.bookings.map((booking) => booking.state)).toEqual(
    before.bookings.map(() => "cancelled"),
  );
  expect(after.activities[0]?.detail).toBe("Marked as spam.");

  const now = await summary();
  expect(now.exits.spam).toBe(counts.exits.spam + 1);
  expect(now.open).toBe(counts.open - 1);
  expect((await list({ tab: "spam" })).map((lead) => lead.id)).toContain(
    before.id,
  );
});

test("a review is refused as a conflict for a lead that is not an unreviewed suspect, and changes nothing", async () => {
  const suspect = await findLead({ needs: "suspects" }, () => true);
  await reviewSuspect(suspect.id, { outcome: "cleared" });
  const targets = [
    suspect, // already reviewed
    await findLead({ verdict: "valid" }, () => true),
    await findLead({ verdict: "awaiting" }, () => true),
    await findLead({ tab: "spam" }, () => true),
  ];
  for (const target of targets) {
    const before = await getLead(target.id);
    await expect(
      reviewSuspect(target.id, { outcome: "spam" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await getLead(target.id)).toEqual(before);
  }
});

const callDone = (lead: Awaited<ReturnType<typeof getLead>>) =>
  lead.bookings.some((booking) => booking.state === "completed");

test("qualified: moves to the Qualified stage with the status Qualified and a timeline entry", async () => {
  const before = await findLead({ tab: "discovery_booked" }, callDone);
  const after = await setQualification(before.id, { decision: "qualified" });
  expect(after).toMatchObject({
    stage: "qualified",
    status: "qualified",
    exit: null,
    updatedAt: NOW.toISOString(),
  });
  expect(after.activities[0]).toMatchObject({
    actor: { kind: "user", name: "Ada Lovelace" },
    type: "Qualified",
  });
  expect((await list({ tab: "qualified" })).map((lead) => lead.id)).toContain(
    before.id,
  );
});

test("not qualified: leaves through Lead Lost with the status Not a fit", async () => {
  const before = await findLead({ tab: "discovery_booked" }, callDone);
  const after = await setQualification(before.id, {
    decision: "not_qualified",
  });
  expect(after).toMatchObject({
    exit: "lost",
    status: "not_a_fit",
    stage: "discovery_booked",
  });
  expect(after.activities[0]?.type).toBe("Not qualified");
});

test("qualification is refused before the call is done, after it was recorded, and once the lead has left", async () => {
  const notYet = await findLead(
    { tab: "discovery_booked", verdict: "valid" },
    (lead) => !callDone(lead),
  );
  const done = await findLead({ tab: "discovery_booked" }, callDone);
  await setQualification(done.id, { decision: "qualified" });
  const gone = await findLead({ tab: "lost" }, () => true);

  for (const target of [notYet, done, gone]) {
    const before = await getLead(target.id);
    await expect(
      setQualification(target.id, { decision: "qualified" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await getLead(target.id)).toEqual(before);
  }
});

test("mark lost: leaves through Lead Lost, and the timeline entry carries the reason", async () => {
  const before = await findLead({ tab: "proposal_sent" }, () => true);
  const after = await markLost(before.id, { reason: "Chose another agency" });
  expect(after).toMatchObject({ exit: "lost", status: "removed" });
  expect(after.activities[0]).toMatchObject({
    type: "Marked lost",
    detail: "Reason: Chose another agency",
    actor: { name: "Ada Lovelace" },
  });
  // Without a reason it still works.
  const other = await findLead({ tab: "qualified" }, () => true);
  expect((await markLost(other.id, {})).exit).toBe("lost");
});

test("mark spam: leaves through Spam and cancels the upcoming call", async () => {
  const before = await findLead(
    { tab: "discovery_booked", verdict: "valid" },
    (lead) => lead.nextBooking !== null,
  );
  const after = await markSpam(before.id);
  expect(after).toMatchObject({
    exit: "spam",
    status: "removed",
    nextBooking: null,
  });
  expect(after.bookings.some((booking) => booking.state === "confirmed")).toBe(
    false,
  );
  expect(after.activities[0]?.type).toBe("Marked spam");
});

test("lost and spam are refused once a lead has left; spam is refused for a won lead", async () => {
  for (const exit of EXITS) {
    const gone = await findLead({ tab: exit }, () => true);
    const before = await getLead(gone.id);
    await expect(markLost(gone.id, {})).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(markSpam(gone.id)).rejects.toMatchObject({ code: "conflict" });
    expect(await getLead(gone.id)).toEqual(before);
  }
  const won = await findLead({ tab: "won" }, () => true);
  await expect(markSpam(won.id)).rejects.toMatchObject({ code: "conflict" });
  expect((await getLead(won.id)).exit).toBeNull();
});
