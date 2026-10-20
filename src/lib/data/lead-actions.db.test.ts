// @vitest-environment node
import "dotenv/config";

import { randomUUID } from "node:crypto";
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

import { db } from "@/db/client";
import { setQualification } from "@/lib/data/leads";
import { TEST_IDS } from "@/test/ghl-ids";
import { resetFakes, signIn } from "@/test/server-fakes";

/*
 * A decision and its GHL write on two real connections (spec 06, "Writes
 * out"): the app's own pool, as in production, and an observer that sees only
 * what has committed. Unlike the other database suites nothing here is rolled
 * back, because a commit is what is under test: the rows are tagged by fresh
 * ids and deleted afterwards. GHL is a stub; no request leaves.
 */

const { DATABASE_URL, DIRECT_URL } = process.env;
const SUITE =
  DATABASE_URL && DIRECT_URL
    ? "lead actions and GHL (two real connections)"
    : "lead actions and GHL: SKIPPED, DATABASE_URL or DIRECT_URL is not set";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);

const ADMIN = {
  id: randomUUID(),
  email: `actions-${randomUUID().slice(0, 8)}@authoritysolutions.com`,
};

describe.skipIf(!DATABASE_URL || !DIRECT_URL)(SUITE, () => {
  const observer = new pg.Client({ connectionString: DIRECT_URL });
  const leadIds: string[] = [];

  /** What has committed for the lead: its events with their sync rows, and its stage. */
  const committed = async (leadId: string) =>
    (
      await observer.query(
        `select l.stage, e.sync_log_id, s.result
           from leads l
           left join lead_status_events e on e.lead_id = l.id
           left join ghl_sync_log s on s.id = e.sync_log_id
          where l.id = $1`,
        [leadId],
      )
    ).rows;

  /** A lead whose discovery call was yesterday: ready for Qualify. */
  const afterCall = async () => {
    const { rows } = await observer.query(
      `insert into leads (ghl_contact_id, ghl_opportunity_id, first_name, stage, verdict,
                          discovery_booking_at, discovery_booking_status)
       values ($1, $2, 'Actions', 'Discovery Call Booked', 'valid', now() - interval '1 day', 'booked')
       returning id`,
      [`actions-contact-${randomUUID()}`, `actions-opp-${randomUUID()}`],
    );
    leadIds.push(rows[0].id);
    return rows[0].id as string;
  };

  beforeAll(async () => {
    await observer.connect();
    await observer.query(
      "insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')",
      [ADMIN.id, ADMIN.email],
    );
    await observer.query(
      "insert into profiles (id, email, first_name, last_name, role) values ($1, $2, 'Actions', 'Admin', 'admin')",
      [ADMIN.id, ADMIN.email],
    );
  });

  afterAll(async () => {
    // Events point at sync rows, so they go first; then the rows, the leads and the admin.
    const ids = [leadIds];
    await observer.query(
      "delete from lead_status_events where lead_id = any($1)",
      ids,
    );
    await observer.query(
      "delete from ghl_sync_log where lead_id = any($1)",
      ids,
    );
    await observer.query("delete from leads where id = any($1)", ids);
    await observer.query("delete from profiles where id = $1", [ADMIN.id]);
    await observer.query("delete from auth.users where id = $1", [ADMIN.id]);
    await observer.end();
    await db.$client.end();
  });

  beforeEach(() => {
    resetFakes();
    signIn({ sub: ADMIN.id, email: ADMIN.email });
    vi.stubEnv("GHL_PRIVATE_TOKEN", "pit-fake-actions-token");
    vi.stubEnv("GHL_LOCATION_ID", "loc-test");
    vi.stubEnv("GHL_IDS", JSON.stringify(TEST_IDS));
    vi.stubEnv("GHL_WRITES_ENABLED", "true");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("the decision commits, with its write pending, before GHL is called", async () => {
    const leadId = await afterCall();
    let stage = TEST_IDS.stages["Discovery Call Booked"];
    let seenAtPut: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          seenAtPut = await committed(leadId);
          stage = JSON.parse(String(init.body)).pipelineStageId;
        }
        return Response.json({
          opportunity: {
            id: url.split("/").at(-1),
            contactId: "contact-1",
            pipelineId: TEST_IDS.pipelineId,
            pipelineStageId: stage,
          },
        });
      }),
    );

    const detail = await setQualification(leadId, { decision: "qualified" });

    expect(seenAtPut).toEqual([
      {
        stage: "Qualified",
        sync_log_id: expect.any(String),
        result: "pending",
      },
    ]);
    expect(detail.stage).toBe("qualified");
    expect(await committed(leadId)).toEqual([
      {
        stage: "Qualified",
        sync_log_id: expect.any(String),
        result: "succeeded",
      },
    ]);
  });

  test("a failed write leaves the decision standing, its sync row failed for Retry", async () => {
    const leadId = await afterCall();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 500 })),
    );

    const detail = await setQualification(leadId, { decision: "qualified" });

    expect(detail.stage).toBe("qualified");
    expect(detail.lastSync?.result).toBe("failed");
    expect(await committed(leadId)).toEqual([
      { stage: "Qualified", sync_log_id: expect.any(String), result: "failed" },
    ]);
  });
});
