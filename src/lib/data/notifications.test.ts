// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST as postRead } from "@/app/api/notifications/[notificationId]/read/route";
import { GET as getList } from "@/app/api/notifications/route";
import { GET as getCount } from "@/app/api/notifications/unread-count/route";
import { updateAccountPreferences } from "@/lib/data/account";
import {
  listVisibleLeads,
  recordProposalStatus,
  resetSampleLeads,
} from "@/lib/data/leads";
import {
  createNotification,
  getUnreadCount,
  listNotifications,
  markNotificationRead,
} from "@/lib/data/notifications";
import { PREVIEW_ROLE_COOKIE, PREVIEW_STAFF_REP } from "@/lib/data/viewer";
import { notificationText } from "@/lib/notifications/rules";
import {
  NOTIFICATION_TYPES,
  type Notification,
  type NotificationPage,
  notificationPageSchema,
  unreadCountSchema,
} from "@/lib/notifications/schemas";
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
/** A brand of CRM or service, which no notification may name (spec 08, check 10). */
const BRANDS =
  /ASCRM|GoHighLevel|HighLevel|\bGHL\b|Zoho|HubSpot|Salesforce|Presenton|SmartPricingTable|Invoice Ninja/i;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  resetFakes();
  resetSampleLeads();
  signIn();
  fake.users.set(ada.id, ada);
});
afterEach(() => vi.useRealTimers());

const viewAs = (role: string) => fake.cookies.set(PREVIEW_ROLE_COOKIE, role);
const everything = async () => (await listNotifications({ limit: 100 })).items;
const refusedWith = (code: string) => expect.objectContaining({ code });
const key = (n: Notification) => `${n.lead.id}:${n.type}`;

const list = (search = "") =>
  getList(new Request(`${ORIGIN}/api/notifications${search}`));
const read = (notificationId: string) =>
  postRead(
    new Request(`${ORIGIN}/api/notifications/${notificationId}/read`, {
      method: "POST",
    }),
    { params: Promise.resolve({ notificationId }) },
  );

// --- what is in the list -------------------------------------------------------

test("every sample notification matches the contract, is one of the three types, and is listed newest first", async () => {
  const page = await listNotifications({ limit: 100 });
  expect(notificationPageSchema.parse(page)).toEqual(page);
  expect(page.nextCursor).toBeNull();
  expect(page.items.length).toBeGreaterThan(5);
  expect(new Set(page.items.map((item) => item.id)).size).toBe(
    page.items.length,
  );

  const times = page.items.map((item) => item.createdAt);
  expect(times).toEqual([...times].sort().reverse());
  // Nothing is dated in the future: the times are the leads' own activities.
  expect(times.every((time) => time <= NOW.toISOString())).toBe(true);
  for (const type of NOTIFICATION_TYPES) {
    expect(page.items.some((item) => item.type === type)).toBe(true);
  }
});

test("the notifications follow from the leads: a suspect awaiting review, a signed proposal on a won lead, an invoice draft", async () => {
  const expected = (await listVisibleLeads()).flatMap((lead) => [
    ...(lead.verdict === "suspect" && !lead.exit
      ? [`${lead.id}:suspect_to_review`]
      : []),
    ...(lead.stage === "won" && lead.proposal?.status === "signed"
      ? [`${lead.id}:proposal_signed`]
      : []),
    ...(lead.invoice?.status === "draft"
      ? [`${lead.id}:invoice_draft_ready`]
      : []),
  ]);
  expect((await everything()).map(key).sort()).toEqual(expected.sort());
});

test("each notification carries its lead's name and company, and its time is when the lead's timeline says it happened", async () => {
  const leads = await listVisibleLeads();
  for (const item of await everything()) {
    const lead = leads.find((candidate) => candidate.id === item.lead.id);
    expect(item.lead).toEqual({
      id: lead?.id,
      name: lead?.name,
      company: lead?.company,
    });
    expect(
      lead?.activities.some((activity) => activity.time === item.createdAt) ||
        lead?.updatedAt === item.createdAt,
    ).toBe(true);
  }
});

test("the text for every type comes from the type and the lead, and names no CRM or service", () => {
  const lead = { id: "lead-01", name: "Sofia Lindgren", company: null };
  const texts = NOTIFICATION_TYPES.map((type) => notificationText(type, lead));
  expect(new Set(texts).size).toBe(NOTIFICATION_TYPES.length);
  for (const text of texts) {
    expect(text).toContain("Sofia Lindgren");
    expect(text).not.toMatch(BRANDS);
    expect(text).not.toMatch(/\bCRM\b/);
  }
});

test("the list is paged with an opaque cursor: every notification appears once, in order, and the last page has no cursor", async () => {
  const all = await everything();
  const seen: Notification[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const page: NotificationPage = await listNotifications({
      cursor,
      limit: 4,
    });
    expect(page.items.length).toBeLessThanOrEqual(4);
    seen.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    pages += 1;
  } while (cursor && pages < 50);

  expect(seen).toEqual(all);
  expect(pages).toBe(Math.ceil(all.length / 4));
});

test("a notification raised between two pages does not repeat or skip what the user is reading", async () => {
  const all = await everything();
  const first = await listNotifications({ limit: 4 });
  const lead = (await listVisibleLeads()).find(
    (candidate) => candidate.stage === "proposal_sent" && !candidate.exit,
  );
  await recordProposalStatus(lead?.id ?? "", "signed");
  await createNotification({
    leadId: lead?.id ?? "",
    type: "proposal_signed",
  });

  const second = await listNotifications({
    cursor: first.nextCursor ?? undefined,
    limit: 4,
  });
  expect(second.items).toEqual(all.slice(4, 8));
});

// --- unread and mark read --------------------------------------------------------

test("a fixed share starts unread, and the unread count is the number of unread notifications", async () => {
  const all = await everything();
  const unread = all.filter((item) => !item.read);
  expect(unread.length).toBeGreaterThan(0);
  expect(unread.length).toBeLessThan(all.length);
  expect(unreadCountSchema.parse(await getUnreadCount())).toEqual({
    count: unread.length,
  });

  // The same share after starting again: nothing about it is random.
  resetSampleLeads();
  expect((await everything()).map((item) => item.read)).toEqual(
    all.map((item) => item.read),
  );
});

test("marking one read lowers the count by one and shows in a later read; doing it twice changes nothing more", async () => {
  const all = await everything();
  const target = all.find((item) => !item.read) as Notification;
  const { count } = await getUnreadCount();

  expect(await markNotificationRead(target.id)).toEqual({
    ...target,
    read: true,
  });
  expect(await getUnreadCount()).toEqual({ count: count - 1 });
  expect((await everything()).find((item) => item.id === target.id)?.read).toBe(
    true,
  );

  expect((await markNotificationRead(target.id)).read).toBe(true);
  expect(await getUnreadCount()).toEqual({ count: count - 1 });
  // Nothing else changed, and nothing moved.
  expect((await everything()).map((item) => item.id)).toEqual(
    all.map((item) => item.id),
  );
});

test("marking an unknown notification read is not found", async () => {
  await expect(markNotificationRead("ntf-nowhere")).rejects.toEqual(
    refusedWith("not_found"),
  );
});

// --- who is notified (question 7, assumed) ---------------------------------------

test("staff see notifications only for the leads they own; admins and owners see every lead's", async () => {
  const forOwner = await everything();
  viewAs("admin");
  expect(await everything()).toEqual(forOwner);

  viewAs("staff");
  const forStaff = await everything();
  const own = (await listVisibleLeads()).map((lead) => lead.id);
  expect(forStaff.length).toBeGreaterThan(0);
  expect(forStaff.length).toBeLessThan(forOwner.length);
  expect(forStaff).toEqual(
    forOwner.filter((item) => own.includes(item.lead.id)),
  );
  expect(await getUnreadCount()).toEqual({
    count: forStaff.filter((item) => !item.read).length,
  });
});

test("the sample is the same whichever role reads it first", async () => {
  const ownerFirst = await everything();

  resetSampleLeads();
  viewAs("staff");
  await everything();
  viewAs("owner");
  expect(await everything()).toEqual(ownerFirst);
});

test("for staff, another rep's notification is not found: it cannot be marked read", async () => {
  const leads = await listVisibleLeads();
  const theirs = (await everything()).find(
    (item) =>
      !item.read &&
      leads.find((lead) => lead.id === item.lead.id)?.owner.id !==
        PREVIEW_STAFF_REP.id,
  ) as Notification;

  viewAs("staff");
  await expect(markNotificationRead(theirs.id)).rejects.toEqual(
    refusedWith("not_found"),
  );
  expect((await read(theirs.id)).status).toBe(404);

  viewAs("owner");
  expect((await everything()).find((item) => item.id === theirs.id)?.read).toBe(
    false,
  );
});

// --- raising a notification --------------------------------------------------------

test("a raised notification appears at the top, unread, and raises the count; raising it again changes nothing", async () => {
  const before = await everything();
  const { count } = await getUnreadCount();
  const lead = (await listVisibleLeads()).find(
    (candidate) => candidate.stage === "proposal_sent" && !candidate.exit,
  );
  const leadId = lead?.id ?? "";

  vi.setSystemTime(new Date(NOW.getTime() + 60_000));
  await recordProposalStatus(leadId, "signed");
  await createNotification({ leadId, type: "proposal_signed" });

  const after = await everything();
  expect(after).toHaveLength(before.length + 1);
  expect(after[0]).toMatchObject({
    type: "proposal_signed",
    lead: { id: leadId, name: lead?.name },
    read: false,
    createdAt: "2026-10-07T12:01:00.000Z",
  });
  expect(await getUnreadCount()).toEqual({ count: count + 1 });

  await createNotification({ leadId, type: "proposal_signed" });
  expect(await everything()).toEqual(after);
});

test("a notification raised before the list was ever read is not doubled by the sample", async () => {
  const lead = (await listVisibleLeads()).find(
    (candidate) => candidate.stage === "proposal_sent" && !candidate.exit,
  );
  await recordProposalStatus(lead?.id ?? "", "signed");
  await createNotification({
    leadId: lead?.id ?? "",
    type: "proposal_signed",
  });

  const mine = (await everything()).filter(
    (item) => item.lead.id === lead?.id && item.type === "proposal_signed",
  );
  expect(mine).toHaveLength(1);
});

test("a notification cannot be raised for an unknown lead, or by staff for another rep's lead", async () => {
  await expect(
    createNotification({ leadId: "lead-nowhere", type: "proposal_signed" }),
  ).rejects.toEqual(refusedWith("not_found"));

  const theirs = (await listVisibleLeads()).find(
    (lead) => lead.owner.id !== PREVIEW_STAFF_REP.id,
  );
  viewAs("staff");
  await expect(
    createNotification({ leadId: theirs?.id ?? "", type: "proposal_signed" }),
  ).rejects.toEqual(refusedWith("not_found"));
});

// --- preferences (mock choice) -----------------------------------------------------

test("a type switched off in account preferences is left out of the list and the unread count", async () => {
  const all = await everything();
  await updateAccountPreferences({
    notifications: {
      suspect_to_review: false,
      proposal_signed: true,
      invoice_draft_ready: true,
    },
  });

  const kept = all.filter((item) => item.type !== "suspect_to_review");
  expect(kept.length).toBeLessThan(all.length);
  expect(await everything()).toEqual(kept);
  expect(await getUnreadCount()).toEqual({
    count: kept.filter((item) => !item.read).length,
  });
});

// --- the guard and the Route Handlers ----------------------------------------------

test("every function refuses a signed-out caller and a caller with no profile", async () => {
  const calls = [
    () => listNotifications({ limit: 10 }),
    () => getUnreadCount(),
    () => markNotificationRead("ntf-lead-03-suspect_to_review"),
    () => createNotification({ leadId: "lead-03", type: "proposal_signed" }),
  ];

  fake.users.clear();
  for (const call of calls) {
    await expect(call()).rejects.toEqual(refusedWith("profile_required"));
  }
  fake.claims = null;
  for (const call of calls) {
    await expect(call()).rejects.toEqual(refusedWith("unauthenticated"));
  }
});

test("the routes answer 401 signed out and 403 without a profile, before reading any input", async () => {
  const requests = [
    () => list("?limit=0"),
    () => getCount(),
    () => read("ntf-nowhere"),
  ];

  fake.users.clear();
  for (const request of requests) {
    const response = await request();
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("profile_required");
  }
  fake.claims = null;
  for (const request of requests) {
    const response = await request();
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
  }
});

test("GET /api/notifications returns a page, follows its cursor, and rejects a bad limit or an unknown parameter", async () => {
  const first = await list();
  expect(first.status).toBe(200);
  const page = notificationPageSchema.parse(await first.json());
  expect(page.items).toEqual((await everything()).slice(0, 10));

  const next = await list(
    `?cursor=${encodeURIComponent(page.nextCursor ?? "")}`,
  );
  expect(notificationPageSchema.parse(await next.json()).items).toEqual(
    (await everything()).slice(10, 20),
  );

  for (const search of ["?limit=0", "?limit=many", "?unread=true"]) {
    const response = await list(search);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_input");
  }
});

test("GET /api/notifications/unread-count and POST .../read agree with each other; an unknown id is 404", async () => {
  const before = unreadCountSchema.parse(await (await getCount()).json());
  const target = (await everything()).find((item) => !item.read);

  const response = await read(target?.id ?? "");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ...target, read: true });
  expect(await (await getCount()).json()).toEqual({ count: before.count - 1 });

  const missing = await read("ntf-nowhere");
  expect(missing.status).toBe(404);
  expect((await missing.json()).error.code).toBe("not_found");
});
