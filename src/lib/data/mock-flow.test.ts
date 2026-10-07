// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getDeck } from "@/lib/data/decks";
import { getInvoice } from "@/lib/data/invoices";
import {
  getLead,
  listLeads,
  listVisibleLeads,
  resetSampleLeads,
} from "@/lib/data/leads";
import { getUnreadCount, listNotifications } from "@/lib/data/notifications";
import {
  generateProposal,
  sendProposal,
  simulateProposalEvent,
} from "@/lib/data/proposals";
import { PREVIEW_ROLE_COOKIE } from "@/lib/data/viewer";
import { listLeadsQuerySchema } from "@/lib/leads/schemas";
import { listNotificationsQuerySchema } from "@/lib/notifications/schemas";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

/*
 * The mockups are separate data-access modules that meet on a lead. This file
 * checks the one path that crosses all of them: a proposal is signed, the lead
 * is won, the invoice draft exists, and its owner is told.
 */

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-10-07T12:00:00.000Z"),
  });
  resetFakes();
  resetSampleLeads();
  signIn();
  fake.users.set("auth-user-1", {
    id: "auth-user-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
  });
});
afterEach(() => vi.useRealTimers());

const firstPage = () =>
  listNotifications(listNotificationsQuerySchema.parse({ limit: "50" }));

test("signing a proposal wins the lead, drafts its invoice and raises both notifications, newest first and unread", async () => {
  const lead = (await listVisibleLeads()).find(
    (item) => item.stage === "qualified" && !item.exit && !item.proposal,
  );
  if (!lead) throw new Error("no qualified sample lead");
  // Seed what the sample already holds, so the count below is only this path's.
  const before = (await getUnreadCount()).count;
  expect(
    (await firstPage()).items.filter((item) => item.lead.id === lead.id),
  ).toEqual([]);

  // A later moment, so the two new notifications are the newest.
  vi.setSystemTime(new Date("2026-10-07T13:00:00.000Z"));
  await generateProposal(lead.id);
  await sendProposal(lead.id);
  expect((await getLead(lead.id)).stage).toBe("proposal_sent");
  expect((await getUnreadCount()).count).toBe(before);

  await simulateProposalEvent(lead.id, "signed");

  expect(await getLead(lead.id)).toMatchObject({
    stage: "won",
    proposal: { status: "signed" },
    invoice: { status: "draft" },
  });
  expect((await getInvoice(lead.id))?.status).toBe("draft");

  expect((await getUnreadCount()).count).toBe(before + 2);
  const mine = (await firstPage()).items.filter(
    (item) => item.lead.id === lead.id,
  );
  expect(mine.map((item) => item.type).sort()).toEqual([
    "invoice_draft_ready",
    "proposal_signed",
  ]);
  expect(mine.every((item) => !item.read)).toBe(true);
  expect(
    (await firstPage()).items.slice(0, 2).map((item) => item.lead.id),
  ).toEqual([lead.id, lead.id]);
});

test("a role preview narrows every mockup the same way: staff reach one rep's leads, decks, proposals and notifications", async () => {
  const everyNotification = (await firstPage()).items.length;

  fake.cookies.set(PREVIEW_ROLE_COOKIE, "staff");
  const own = new Set(
    (
      await listLeads(listLeadsQuerySchema.parse({ tab: "open", limit: "100" }))
    ).items.map((lead) => lead.id),
  );
  const notified = (await firstPage()).items;
  expect(notified.length).toBeLessThan(everyNotification);
  expect(notified.every((item) => own.has(item.lead.id))).toBe(true);

  fake.cookies.set(PREVIEW_ROLE_COOKIE, "owner");
  const other = (
    await listLeads(listLeadsQuerySchema.parse({ tab: "open", limit: "100" }))
  ).items.find((lead) => !own.has(lead.id));
  if (!other) throw new Error("no lead owned by another rep");

  fake.cookies.set(PREVIEW_ROLE_COOKIE, "staff");
  for (const call of [
    () => getDeck(other.id),
    () => generateProposal(other.id),
    () => getInvoice(other.id),
  ]) {
    await expect(call()).rejects.toMatchObject({ code: "not_found" });
  }
});
