// @vitest-environment node
import "dotenv/config";

import { eq, like, TransactionRollbackError } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import * as schema from "@/db/schema";
import type { GhlContact, GhlOpportunity } from "@/lib/services/ghl";
import { TEST_IDS } from "@/test/ghl-ids";

import { syncPage } from "./ghl-sync";

/*
 * The import and the reconcile against a stubbed GHL and the real database.
 * Each test runs in a Drizzle transaction that is rolled back, and the app's
 * `db` is bound to it, so the job's own transaction is a savepoint inside it
 * and nothing is ever committed.
 */

const DIRECT_URL = process.env.DIRECT_URL;
const SUITE = DIRECT_URL
  ? "GHL import and reconcile (real database, stubbed GHL)"
  : "GHL import and reconcile: SKIPPED, DIRECT_URL is not set";

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

/** The stubbed GHL: one page of opportunities, and their contacts. */
const ghl = vi.hoisted(() => ({
  opportunities: [] as GhlOpportunity[],
  contacts: new Map<string, GhlContact>(),
}));
vi.mock("@/lib/services/ghl", async (original) => ({
  ...(await original<typeof import("@/lib/services/ghl")>()),
  searchPipelineOpportunities: async () => ({
    opportunities: ghl.opportunities,
    next: null,
  }),
  getContact: async (id: string) => ghl.contacts.get(id),
}));

const opportunity = (
  n: number,
  stage: keyof typeof TEST_IDS.stages,
  leadStatus: string,
): GhlOpportunity => ({
  id: `sync-test-opp-${n}`,
  contactId: `sync-test-contact-${n}`,
  pipelineId: TEST_IDS.pipelineId,
  pipelineStageId: TEST_IDS.stages[stage],
  assignedTo: null,
  updatedAt: "2026-10-01T00:00:00.000Z",
  customFields: [
    {
      id: TEST_IDS.opportunityFields.lead_status,
      fieldValueString: leadStatus,
    },
  ],
});

type Db = NodePgDatabase<typeof schema>;

describe.skipIf(!DIRECT_URL)(SUITE, () => {
  let client: pg.Client | undefined;
  let root: Db;

  /** Runs `body` with the app's db bound to a transaction that is then rolled back. */
  const inRollback = (body: (db: Db) => Promise<void>) =>
    root
      .transaction(async (t) => {
        const db = t as unknown as Db;
        tx.db = db;
        // The statuses the stub uses, in case the seed migration is not applied here.
        await db
          .insert(schema.statusDefs)
          .values(
            ["New - Contacted", "Qualified - Pending Proposal"].map(
              (value, position) => ({
                value,
                groupName: value.split(" - ")[0],
                position,
                stages: ["New Lead" as const],
                tone: "neutral",
              }),
            ),
          )
          .onConflictDoNothing();
        ghl.opportunities = [1, 2].map((n) =>
          opportunity(n, "New Lead", "New - Contacted"),
        );
        ghl.contacts = new Map(
          [1, 2].map((n) => [
            `sync-test-contact-${n}`,
            {
              id: `sync-test-contact-${n}`,
              firstName: `Test ${n}`,
              customFields: [],
            },
          ]),
        );
        await body(db);
        t.rollback();
      })
      .catch((error) => {
        if (!(error instanceof TransactionRollbackError)) throw error;
      });

  const testLeads = (db: Db) =>
    db
      .select()
      .from(schema.leads)
      .where(like(schema.leads.ghlContactId, "sync-test-%"))
      .orderBy(schema.leads.ghlContactId);
  const events = (db: Db, leadId: string) =>
    db
      .select()
      .from(schema.leadStatusEvents)
      .where(eq(schema.leadStatusEvents.leadId, leadId));

  beforeAll(async () => {
    vi.stubEnv("GHL_LOCATION_ID", "loc-test");
    vi.stubEnv("GHL_IDS", JSON.stringify(TEST_IDS));
    client = new pg.Client({ connectionString: DIRECT_URL });
    await client.connect();
    root = drizzle({ client, schema });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await client?.end();
  });

  test("import twice: each opportunity lands once, the second run changes nothing", () =>
    inRollback(async (db) => {
      expect((await syncPage("import", null)).counts).toMatchObject({
        created: 2,
      });
      const once = await testLeads(db);
      expect((await syncPage("import", null)).counts).toMatchObject({
        created: 0,
        updated: 0,
        unchanged: 2,
      });
      const twice = await testLeads(db);
      expect(twice).toEqual(once);
      expect(new Set(twice.map((lead) => lead.ghlOpportunityId)).size).toBe(2);
      for (const lead of twice) {
        const actors = (await events(db, lead.id)).map((e) => e.actor);
        expect(actors).toEqual(["import"]);
      }
    }));

  test("reconcile: a changed stage corrects the lead with one 'reconcile' event; an unchanged lead writes nothing", () =>
    inRollback(async (db) => {
      await syncPage("import", null);
      const [one, two] = await testLeads(db);

      ghl.opportunities[0] = opportunity(
        1,
        "Qualified",
        "Qualified - Pending Proposal",
      );
      expect((await syncPage("reconcile", null)).counts).toEqual({
        created: 0,
        updated: 1,
        unchanged: 1,
        skipped: 0,
      });

      const [corrected, untouched] = await testLeads(db);
      expect(corrected).toMatchObject({
        id: one.id,
        stage: "Qualified",
        leadStatus: "Qualified - Pending Proposal",
      });
      const reconciled = (await events(db, one.id)).filter(
        (event) => event.actor === "reconcile",
      );
      expect(reconciled).toHaveLength(1);
      expect(reconciled[0]).toMatchObject({
        fromStage: "New Lead",
        toStage: "Qualified",
        fromStatus: "New - Contacted",
        toStatus: "Qualified - Pending Proposal",
        note: "corrected: stage, leadStatus",
      });

      // The unchanged lead: the same row (updated_at included), no new event.
      expect(untouched).toEqual(two);
      expect(await events(db, two.id)).toHaveLength(1);
    }));

  test("reconcile leaves a closed lead alone", () =>
    inRollback(async (db) => {
      ghl.opportunities = [opportunity(1, "Lead Lost", "New - Contacted")];
      await syncPage("import", null);
      ghl.opportunities = [opportunity(1, "New Lead", "New - Contacted")];
      expect((await syncPage("reconcile", null)).counts).toMatchObject({
        skipped: 1,
      });
      expect((await testLeads(db))[0].stage).toBe("Lead Lost");
    }));
});
