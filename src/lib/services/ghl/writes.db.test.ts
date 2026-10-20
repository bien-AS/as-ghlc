// @vitest-environment node
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { eq, sql, TransactionRollbackError } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import * as schema from "@/db/schema";
import { listSyncLog, retryWrite } from "@/lib/data/sync-log";
import { TEST_IDS } from "@/test/ghl-ids";
import { resetFakes, signIn } from "@/test/server-fakes";

import {
  writeDeckLink,
  writeMarkSpam,
  writeQualification,
  writeValidationVerdict,
} from "./writes";

/*
 * The write runner (spec 06, "Writes out"; checks 6 to 9, the app's side)
 * against a STUBBED GHL and the real database. Each test runs in a transaction
 * that is rolled back. `fetch` is replaced for every test, so no request can
 * reach GHL, and the token is a made-up one.
 */

const DIRECT_URL = process.env.DIRECT_URL;
const SUITE = DIRECT_URL
  ? "GHL writes (real database, stubbed GHL)"
  : "GHL writes: SKIPPED, DIRECT_URL is not set";

const TOKEN = "pit-fake-write-token-0123456789";
const BASE = "https://services.leadconnectorhq.com";

const tx = vi.hoisted(() => ({ db: undefined as unknown as object }));
vi.mock("@/db/client", () => ({
  db: new Proxy(
    {},
    {
      get: (_target, key) => {
        const value = Reflect.get(tx.db, key);
        return typeof value === "function" ? value.bind(tx.db) : value;
      },
    },
  ),
}));
vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);

type Db = NodePgDatabase<typeof schema>;

/** The stubbed GHL: one opportunity whose stage a PUT moves, unless `stuck`. */
const ghl = {
  stage: TEST_IDS.stages["Discovery Call Booked"],
  stuck: false,
  /** Answers to hand out before the normal ones, in order. */
  queue: [] as (Response | Error)[],
};

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const next = ghl.queue.shift();
  if (next instanceof Error) throw next;
  if (next) return next;
  const { pathname } = new URL(url);
  const method = init?.method ?? "GET";
  if (method === "POST" && pathname === "/contacts/upsert") {
    return Response.json({ new: false, contact: { id: "contact-1" } });
  }
  if (pathname === "/opportunities/opp-1") {
    if (method === "PUT" && !ghl.stuck) {
      ghl.stage = JSON.parse(String(init?.body)).pipelineStageId;
    }
    return Response.json({
      opportunity: {
        id: "opp-1",
        contactId: "contact-1",
        pipelineId: TEST_IDS.pipelineId,
        pipelineStageId: ghl.stage,
      },
    });
  }
  return new Response("not found", { status: 404 });
});

const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    method: init?.method ?? "GET",
    path: url.replace(BASE, ""),
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }));

const ADMIN = {
  id: randomUUID(),
  email: "writes-admin@authoritysolutions.com",
  role: "admin" as const,
};

describe.skipIf(!DIRECT_URL)(SUITE, () => {
  let client: pg.Client | undefined;
  let root: Db;
  let lead: { id: string; email: string | null; phone: string | null };
  const opp = () => ({ id: lead.id, ghlOpportunityId: "opp-1" });

  const rows = (db: Db) =>
    db
      .select()
      .from(schema.ghlSyncLog)
      .where(eq(schema.ghlSyncLog.leadId, lead.id));

  /** Runs `body` with the app's db bound to a transaction that is then rolled back. */
  const inRollback = (body: (db: Db) => Promise<void>) =>
    root
      .transaction(async (t) => {
        const db = t as unknown as Db;
        tx.db = db;
        [lead] = await db
          .insert(schema.leads)
          .values({
            ghlContactId: `writes-test-${randomUUID()}`,
            ghlOpportunityId: `writes-test-${randomUUID()}`,
            email: "lead@example.com",
            phone: "+15550100",
          })
          .returning();
        await body(db);
        t.rollback();
      })
      .catch((error) => {
        if (!(error instanceof TransactionRollbackError)) throw error;
      });

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DIRECT_URL });
    await client.connect();
    root = drizzle({ client, schema });
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(() => {
    vi.stubEnv("GHL_PRIVATE_TOKEN", TOKEN);
    vi.stubEnv("GHL_LOCATION_ID", "loc-test");
    vi.stubEnv("GHL_IDS", JSON.stringify(TEST_IDS));
    vi.stubEnv("GHL_WRITES_ENABLED", "true");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    ghl.stage = TEST_IDS.stages["Discovery Call Booked"];
    ghl.stuck = false;
    ghl.queue = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("writes disabled: W1, W3 and W4 each log one 'skipped' row and make no call", async () => {
    for (const value of [undefined, "false", "TRUE", "1"]) {
      await inRollback(async (db) => {
        vi.stubEnv("GHL_WRITES_ENABLED", value);
        await writeValidationVerdict(lead, "valid", "Looks real.", "run-1");
        await writeQualification(opp(), "qualified", "event-1");
        await writeMarkSpam(lead, "event-9");

        const logged = await rows(db);
        expect(logged.map((row) => row.writeType).sort()).toEqual([
          "w1_verdict",
          "w3_qualification",
          "w4_mark_spam",
        ]);
        for (const row of logged) {
          expect(row).toMatchObject({
            result: "skipped",
            lastError: "writes disabled",
            attempts: 0,
          });
        }
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("W2 stays off behind ghlDeckLinkWrite: nothing logged, no call", () =>
    inRollback(async (db) => {
      expect(await writeDeckLink(lead, "https://deck.example/1")).toBeNull();
      expect(await rows(db)).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    }));

  test("W1, W3 and W4 send the specified requests and succeed", () =>
    inRollback(async (db) => {
      const w1 = await writeValidationVerdict(
        lead,
        "suspect",
        "Brief.",
        "run-1",
      );
      const w3 = await writeQualification(opp(), "not_qualified", "event-1");
      const w4 = await writeMarkSpam(lead, "event-9");

      const contact = {
        locationId: "loc-test",
        email: "lead@example.com",
        phone: "+15550100",
      };
      expect(calls()).toEqual([
        {
          method: "POST",
          path: "/contacts/upsert",
          body: {
            ...contact,
            customFields: [
              { id: "cf-validation_status", value: "Suspect" },
              { id: "cf-validation_summary", value: "Brief." },
            ],
          },
        },
        {
          method: "PUT",
          path: "/opportunities/opp-1",
          body: {
            pipelineId: "pipe",
            pipelineStageId: "s-lost",
            customFields: [
              { id: "of-qualification_decision", field_value: "Not Qualified" },
            ],
          },
        },
        // The read-back after the stage write (check 9).
        { method: "GET", path: "/opportunities/opp-1", body: undefined },
        {
          method: "POST",
          path: "/contacts/upsert",
          body: {
            ...contact,
            customFields: [{ id: "cf-validation_status", value: "Spam" }],
          },
        },
      ]);
      for (const row of [w1, w3, w4]) {
        expect(row).toMatchObject({
          result: "succeeded",
          attempts: 1,
          lastError: null,
        });
      }
      expect(w3.idempotencyKey).toBe(
        `w3_qualification:${lead.id}:not_qualified:event-1`,
      );
      expect(await rows(db)).toHaveLength(3);
    }));

  test("the same W3 twice makes one GHL change and one succeeded row (check 7)", () =>
    inRollback(async (db) => {
      await writeQualification(opp(), "qualified", "event-1");
      const again = await writeQualification(opp(), "qualified", "event-1");
      expect(calls().filter((call) => call.method === "PUT")).toHaveLength(1);
      expect(again).toMatchObject({ result: "succeeded", attempts: 1 });
      expect(await rows(db)).toHaveLength(1);
    }));

  test("a decision made again later is written again: Qualified, Not Qualified, Qualified", () =>
    inRollback(async (db) => {
      const flips = [
        await writeQualification(opp(), "qualified", "event-1"),
        await writeQualification(opp(), "not_qualified", "event-2"),
        await writeQualification(opp(), "qualified", "event-3"),
      ];
      expect(flips.map((row) => row.result)).toEqual([
        "succeeded",
        "succeeded",
        "succeeded",
      ]);
      const puts = calls().filter((call) => call.method === "PUT");
      expect(puts.map((call) => call.body.pipelineStageId)).toEqual([
        "s-qual",
        "s-lost",
        "s-qual",
      ]);
      expect(ghl.stage).toBe("s-qual");
      expect(await rows(db)).toHaveLength(3);
    }));

  test("a 429 is retried after backoff and the write succeeds (check 8)", () =>
    inRollback(async () => {
      vi.useFakeTimers({ toFake: ["setTimeout"] });
      ghl.queue = [
        new Response("slow down", {
          status: 429,
          headers: { "Retry-After": "2" },
        }),
      ];
      const run = writeMarkSpam(lead, "event-9");
      await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1));
      await vi.advanceTimersByTimeAsync(2000);
      expect(await run).toMatchObject({ result: "succeeded", attempts: 1 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }));

  test("unreachable GHL stays failed; Retry succeeds once GHL answers (check 8)", () =>
    inRollback(async (db) => {
      ghl.queue = [new TypeError("fetch failed")];
      const failed = await writeQualification(opp(), "qualified", "event-1");
      expect(failed).toMatchObject({
        result: "failed",
        attempts: 1,
        lastError: "fetch failed",
      });

      // The admin who presses Retry.
      await db.execute(
        sql`insert into auth.users (id, email, aud, role) values (${ADMIN.id}, ${ADMIN.email}, 'authenticated', 'authenticated')`,
      );
      await db
        .insert(schema.profiles)
        .values({ ...ADMIN, firstName: "W", lastName: "A" });
      resetFakes();
      signIn({ sub: ADMIN.id, email: ADMIN.email });

      const retried = await retryWrite(failed.id);
      expect(retried).toMatchObject({
        id: failed.id,
        result: "succeeded",
        attempts: 2,
        lastError: null,
      });
      expect(ghl.stage).toBe("s-qual");
    }));

  test("listSyncLog: newest first, filtered, paged by cursor", () =>
    inRollback(async (db) => {
      await db.execute(
        sql`insert into auth.users (id, email, aud, role) values (${ADMIN.id}, ${ADMIN.email}, 'authenticated', 'authenticated')`,
      );
      await db
        .insert(schema.profiles)
        .values({ ...ADMIN, firstName: "W", lastName: "A" });
      resetFakes();
      signIn({ sub: ADMIN.id, email: ADMIN.email });
      // Far in the future, so they come before any row already in the table.
      const at = (n: number) => new Date(Date.UTC(2999, 0, 1, 0, 0, n));
      await db.insert(schema.ghlSyncLog).values(
        Array.from({ length: 52 }, (_, n) => ({
          leadId: lead.id,
          writeType:
            n % 2 ? ("w4_mark_spam" as const) : ("w1_verdict" as const),
          idempotencyKey: `list-test:${lead.id}:${n}`,
          payload: {},
          result: "failed" as const,
          createdAt: at(n),
        })),
      );
      const first = await listSyncLog({});
      expect(first.items).toHaveLength(50);
      expect(first.items[0].idempotencyKey).toBe(`list-test:${lead.id}:51`);
      expect(first.nextCursor).toBe(first.items[49].id);
      const second = await listSyncLog({ cursor: first.nextCursor ?? "" });
      expect(second.items.slice(0, 2).map((row) => row.idempotencyKey)).toEqual(
        [`list-test:${lead.id}:1`, `list-test:${lead.id}:0`],
      );
      const spam = await listSyncLog({ writeType: "w4_mark_spam" });
      expect(spam.items.every((row) => row.writeType === "w4_mark_spam")).toBe(
        true,
      );
      expect(
        (await listSyncLog({ result: "succeeded" })).items.some(
          (row) => row.leadId === lead.id,
        ),
      ).toBe(false);
    }));

  test("a stage write the read-back contradicts is failed, never succeeded (check 9)", () =>
    inRollback(async () => {
      ghl.stuck = true; // GHL answers 200 and leaves the stage where it was
      const row = await writeQualification(opp(), "qualified", "event-1");
      expect(row.result).toBe("failed");
      expect(row.lastError).toMatch(
        /Read-back: .* is in stage s-dcb, not s-qual/,
      );
    }));

  test("an upsert that created a new contact is failed, not succeeded", () =>
    inRollback(async () => {
      ghl.queue = [Response.json({ new: true, contact: { id: "other" } })];
      const row = await writeMarkSpam(lead, "event-9");
      expect(row).toMatchObject({ result: "failed" });
      expect(row.lastError).toMatch(/new contact/);
    }));

  test("no recorded response or error holds the token (check 11)", () =>
    inRollback(async (db) => {
      ghl.queue = [
        new Response(`bad token ${TOKEN}`, { status: 401 }),
        Response.json({ new: false, echo: `Bearer ${TOKEN}` }),
      ];
      const failed = await writeMarkSpam(lead, "event-9");
      expect(failed.result).toBe("failed");
      await writeValidationVerdict(lead, "valid", "ok", "run-2");
      const stored = JSON.stringify(await rows(db));
      expect(stored).toContain("[redacted]");
      expect(stored).not.toContain(TOKEN);
    }));
});
