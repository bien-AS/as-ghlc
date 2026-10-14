// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { GET as getLog } from "@/app/api/validation-log/route";
import { resetSampleLeads, reviewSuspect } from "@/lib/data/leads";
import { listValidationLog } from "@/lib/data/validation-log";
import { PREVIEW_ROLE_COOKIE } from "@/lib/data/viewer";
import { validationLogSchema } from "@/lib/validation/schemas";
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

test("every verdict is listed once, newest first, and matches its contract", async () => {
  const log = await listValidationLog();
  expect(validationLogSchema.parse(log)).toEqual(log);
  expect(log.items.length).toBeGreaterThan(5);
  expect(new Set(log.items.map((entry) => entry.id)).size).toBe(
    log.items.length,
  );
  const times = log.items.map((entry) => entry.at);
  expect(times).toEqual([...times].sort().reverse());
});

test("a cost that was not measured is null, never zero", async () => {
  const { items } = await listValidationLog();
  expect(items.every((entry) => entry.cost === null)).toBe(true);
});

test("a rep's review shows as an override, and the AI's own result is kept", async () => {
  const before = (await listValidationLog()).items.find(
    (entry) => entry.result === "suspect" && entry.override === null,
  );
  expect(before).toBeDefined();
  const leadId = before?.lead.id as string;

  await reviewSuspect(leadId, { outcome: "cleared" });

  const after = (await listValidationLog()).items.find(
    (entry) => entry.lead.id === leadId,
  );
  expect(after?.result).toBe("suspect");
  expect(after?.override).toMatchObject({
    outcome: "cleared",
    by: "Ada Lovelace",
  });
});

test("staff cannot read the log: the data function and the route both refuse with 403", async () => {
  fake.cookies.set(PREVIEW_ROLE_COOKIE, "staff");
  await expect(listValidationLog()).rejects.toMatchObject({
    code: "forbidden",
  });
  expect((await getLog()).status).toBe(403);
});

test("a signed-out request gets 401", async () => {
  fake.claims = null;
  expect((await getLog()).status).toBe(401);
});
