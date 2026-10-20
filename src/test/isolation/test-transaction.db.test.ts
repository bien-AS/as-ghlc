// @vitest-environment node
import "dotenv/config";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, test } from "vitest";

import { testTransaction } from "./test-transaction";

const DIRECT_URL = process.env.DIRECT_URL;

// The leak this guards: a timed-out hook's next statement, queued behind the
// rollback, ran outside the transaction and committed.
test.skipIf(!DIRECT_URL)(
  "no statement reaches the server once the rollback has started",
  async () => {
    const transaction = testTransaction(DIRECT_URL as string, "isolation:self");
    await transaction.ready;
    const straggler = transaction.client.query("select pg_sleep(0.2)");
    const rollback = transaction.rollback();
    await straggler;
    await expect(transaction.client.query("select 1")).rejects.toThrow(
      "already rolled back",
    );
    await rollback;
  },
);

// The leak this guards: code under test that rolls back its own transaction
// ended the test's, and every statement after it committed.
test.skipIf(!DIRECT_URL)(
  "a transaction opened inside it is a savepoint: its rollback keeps the test's transaction",
  async () => {
    const transaction = testTransaction(DIRECT_URL as string, "isolation:self");
    await transaction.ready;
    const db = drizzle({ client: transaction.client });
    try {
      await db.execute(sql`create temp table nested_probe (x int)`);
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(sql`insert into nested_probe values (1)`);
          throw new Error("refused");
        }),
      ).rejects.toThrow("refused");
      await db.transaction(async (tx) => {
        await tx.execute(sql`insert into nested_probe values (2)`);
      });
      // Created inside the test's transaction: still there, so it is still open.
      const { rows } = await db.execute(sql`select x from nested_probe`);
      expect(rows).toEqual([{ x: 2 }]);
    } finally {
      await transaction.rollback();
    }
  },
);
