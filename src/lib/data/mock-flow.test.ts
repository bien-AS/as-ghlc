// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getDeck } from "@/lib/data/decks";
import { getInvoice } from "@/lib/data/invoices";
import { listVisibleLeads } from "@/lib/data/leads";
import { listNotifications } from "@/lib/data/notifications";
import { generateProposal } from "@/lib/data/proposals";
import { resetSampleData } from "@/lib/data/sample";
import { listNotificationsQuerySchema } from "@/lib/notifications/schemas";
import { resetLeadStore, updateLead } from "@/test/lead-store";
import { fake, resetFakes, signIn, viewAs } from "@/test/server-fakes";

/*
 * The deck, proposal, invoice and notification mockups still run on sample
 * stores of their own, and meet the real leads (spec 07) only through the
 * leads module: `getLead` and `listVisibleLeads`, which apply the viewer's
 * scope. These check that path with an in-memory lead table standing in for
 * Postgres (src/test/lead-store.ts).
 */

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);
vi.mock("@/lib/data/leads", async (original) => ({
  ...(await original<typeof import("@/lib/data/leads")>()),
  ...(await import("@/test/lead-store")).leadsModule,
}));

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-10-07T12:00:00.000Z"),
  });
  resetFakes();
  resetSampleData();
  resetLeadStore();
  signIn();
  fake.users.set("auth-user-1", {
    id: "auth-user-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
  });
});
afterEach(() => vi.useRealTimers());

const notifiedLeads = async () =>
  new Set(
    (
      await listNotifications(
        listNotificationsQuerySchema.parse({ limit: "50" }),
      )
    ).items.map((item) => item.lead.id),
  );

test("notifications are raised only for leads the viewer may see: a rep's name only the rep's own leads", async () => {
  // Two suspects, one each: each raises "suspect to review".
  updateLead("lead-imogen", { verdict: "suspect" });
  expect([...(await notifiedLeads())].sort()).toEqual([
    "lead-emeka",
    "lead-imogen",
  ]);

  viewAs("rep");
  const own = new Set((await listVisibleLeads()).map((lead) => lead.id));
  expect([...own].sort()).toEqual(["lead-desmond", "lead-imogen"]);
  expect([...(await notifiedLeads())]).toEqual(["lead-imogen"]);
});

test("a rep's request for a deck, a proposal or an invoice on another rep's lead is not found", async () => {
  viewAs("rep");
  for (const call of [
    () => getDeck("lead-sofia"),
    () => generateProposal("lead-sofia"),
    () => getInvoice("lead-sofia"),
  ]) {
    await expect(call()).rejects.toMatchObject({ code: "not_found" });
  }
});
