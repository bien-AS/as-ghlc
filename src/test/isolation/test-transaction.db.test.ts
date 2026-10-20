// @vitest-environment node
import "dotenv/config";

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
