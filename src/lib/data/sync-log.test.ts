// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { GET as getLog } from "@/app/api/sync-log/route";
import { markLost, markSpam, resetSampleLeads } from "@/lib/data/leads";
import { listSyncLog, recordSyncWrite } from "@/lib/data/sync-log";
import { PREVIEW_ROLE_COOKIE } from "@/lib/data/viewer";
import { syncLogSchema } from "@/lib/sync/schemas";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);

const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

beforeEach(() => {
  resetFakes();
  resetSampleLeads();
  signIn();
  fake.users.set(ada.id, ada);
});

const write = {
  kind: "stage_write" as const,
  summary: "Stage set to lost",
  actor: "Ada Lovelace",
  idempotencyKey: "stage_write:lead-1:lost",
  lead: { id: "lead-1", name: "Example Lead" },
};

test("a write is logged as sent, and a repeat with the same key is skipped, not sent again", () => {
  const first = recordSyncWrite(write);
  const second = recordSyncWrite(write);
  expect(first.outcome).toBe("sent");
  expect(second.outcome).toBe("skipped_duplicate");
  expect(second.id).not.toBe(first.id);
});

test("marking a lead lost writes to the log, and the log matches its contract", async () => {
  await markLost("lead-09", {});

  const log = await listSyncLog();
  expect(syncLogSchema.parse(log)).toEqual(log);
  expect(log.items[0]).toMatchObject({
    kind: "stage_write",
    outcome: "sent",
    actor: "Ada Lovelace",
    lead: { id: "lead-09" },
  });
});

test("marking a lead spam writes the status and the booking cancellation, newest first", async () => {
  await markSpam("lead-09");
  const log = await listSyncLog();
  expect(log.items.map((entry) => entry.kind)).toEqual([
    "booking_cancel",
    "status_write",
  ]);
});

test("staff cannot read the log: the data function and the route both refuse with 403", async () => {
  fake.cookies.set(PREVIEW_ROLE_COOKIE, "staff");
  await expect(listSyncLog()).rejects.toMatchObject({ code: "forbidden" });
  expect((await getLog()).status).toBe(403);
});

test("a signed-out request gets 401", async () => {
  fake.claims = null;
  expect((await getLog()).status).toBe(401);
});
