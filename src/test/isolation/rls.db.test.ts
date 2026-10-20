// @vitest-environment node
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import * as schema from "@/db/schema";

/*
 * The database check (spec 01 section 4, acceptance check 4; ADR-0007): as
 * Supabase's `anon` and `authenticated` roles, every business table returns no
 * rows and refuses every write. One row per table is seeded first, so "no
 * rows" means RLS hid it, not that the table was empty. Everything runs in one
 * transaction that is rolled back; the fake auth users use obviously fake
 * addresses and are never committed.
 */

const DIRECT_URL = process.env.DIRECT_URL;
/** Without a database the suite is skipped, and its name says why. */
const SUITE = DIRECT_URL
  ? "RLS default-deny (real database)"
  : "RLS default-deny: SKIPPED, DIRECT_URL is not set";

const ids = {
  profile: [randomUUID(), randomUUID()],
  lead: randomUUID(),
  template: randomUUID(),
  meeting: randomUUID(),
  proposal: randomUUID(),
};

/**
 * One valid row per table: n = 0 is the seeded row, n = 1 the row each role
 * tries to insert (unique values, the same parents), in foreign-key order.
 */
const rows = (n: 0 | 1): [PgTable, Record<string, unknown>][] => [
  [
    schema.profiles,
    {
      id: ids.profile[n],
      email: `rls-${n}@isolation.test`,
      firstName: "Rls",
      lastName: "Check",
    },
  ],
  [
    schema.statusDefs,
    {
      value: `rls-status-${n}`,
      groupName: "rls",
      position: n,
      stages: ["New Lead"],
      tone: "neutral",
    },
  ],
  [
    schema.leads,
    {
      id: n === 0 ? ids.lead : randomUUID(),
      ghlContactId: `rls-contact-${n}`,
    },
  ],
  [schema.leadResearch, { leadId: ids.lead }],
  [
    schema.validationRuns,
    { leadId: ids.lead, source: "rule", verdict: "valid" },
  ],
  [
    schema.ghlSyncLog,
    {
      writeType: "w1_verdict",
      idempotencyKey: `rls-key-${n}`,
      payload: {},
    },
  ],
  [schema.leadStatusEvents, { leadId: ids.lead, actor: "user" }],
  [
    schema.deckTemplates,
    {
      id: n === 0 ? ids.template : randomUUID(),
      group: "discovery_call",
      version: `rls-${n}`,
    },
  ],
  [
    schema.decks,
    { leadId: ids.lead, templateId: ids.template, status: "ready" },
  ],
  [
    schema.meetings,
    {
      id: n === 0 ? ids.meeting : randomUUID(),
      fathomRecordingId: `rls-recording-${n}`,
    },
  ],
  [
    schema.transcripts,
    n === 0
      ? { meetingId: ids.meeting, turns: [] }
      : { leadId: ids.lead, turns: [] },
  ],
  [
    schema.proposals,
    {
      id: n === 0 ? ids.proposal : randomUUID(),
      leadId: ids.lead,
      status: "draft",
    },
  ],
  [schema.proposalRevisions, { proposalId: ids.proposal, revision: n + 1 }],
  [
    schema.invoices,
    {
      proposalId: ids.proposal,
      kind: n === 0 ? "one_time" : "recurring",
      status: "draft",
    },
  ],
  [
    schema.notifications,
    { profileId: ids.profile[0], type: "suspect_to_review", body: "rls" },
  ],
  [
    schema.integrationConnections,
    { provider: n === 0 ? "presenton" : "fathom" },
  ],
  [schema.appSettings, { key: `rls-${n}`, value: {} }],
  [
    schema.webhookEvents,
    {
      provider: "ghl",
      eventId: `rls-event-${n}`,
      type: "rls",
      verified: false,
      payload: {},
    },
  ],
];

const tables = rows(0).map(([table]) => table);

describe.skipIf(!DIRECT_URL)(SUITE, () => {
  let client: pg.Client | undefined;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DIRECT_URL });
    await client.connect();
    await client.query("begin");
    db = drizzle({ client, schema });
    for (const [i, id] of ids.profile.entries()) {
      await client.query(
        "insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')",
        [id, `rls-${i}@isolation.test`],
      );
    }
    for (const [table, row] of rows(0)) await db.insert(table).values(row);
  });

  afterAll(async () => {
    await client?.query("rollback");
    await client?.end();
  });

  test("the check covers all eighteen tables", () => {
    expect(tables).toHaveLength(18);
  });

  // The catalog, not the Drizzle list: a table added outside the schema is caught too.
  test("no table in schema public has row-level security off", async () => {
    const { rows: open } = await (client as pg.Client).query(
      `select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
         and not c.relrowsecurity`,
    );
    expect(open).toEqual([]);
  });

  test("schema public has no RLS policies (default deny)", async () => {
    const { rows: found } = await (client as pg.Client).query(
      "select count(*)::int as n from pg_policies where schemaname = 'public'",
    );
    expect(found[0].n).toBe(0);
  });

  describe.each(["anon", "authenticated"])("as %s", (role) => {
    test.each(
      rows(1).map(([table, row]) => [getTableConfig(table).name, table, row]),
    )("%s: no rows, and every write refused", async (name, table, row) => {
      const q = (sql: string) => (client as pg.Client).query(sql);
      await q("savepoint probe");
      try {
        await q(`set local role ${role}`);
        const { rows: found } = await q(
          `select count(*)::int as n from "${name}"`,
        );
        expect(found[0].n, "rows visible").toBe(0);
        expect(
          (await q(`update "${name}" set updated_at = updated_at`)).rowCount,
          "rows updated",
        ).toBe(0);
        expect(
          (await q(`delete from "${name}"`)).rowCount,
          "rows deleted",
        ).toBe(0);
        const inserted = await db
          .insert(table as PgTable)
          .values(row as Record<string, unknown>)
          .then(
            () => "inserted",
            (error) => error.cause?.code ?? String(error),
          );
        // insufficient_privilege: the row-level security policy refused it.
        expect(inserted, "insert").toBe("42501");
      } finally {
        await q("rollback to savepoint probe");
      }
    });
  });
});
