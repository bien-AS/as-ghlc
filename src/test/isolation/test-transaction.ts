import pg from "pg";

/**
 * One connection whose every statement runs in a single transaction that is
 * rolled back. Once `rollback` starts, no further statement reaches the server:
 * a hook or test that timed out keeps running, and its next statement would
 * otherwise land after the rollback, outside any transaction, and commit.
 * The advisory lock makes concurrent runs of a suite (other agents, the
 * pre-push hook) take turns instead of blocking on each other's fixed keys.
 */
export function testTransaction(connectionString: string, lock: string) {
  const client = new pg.Client({ connectionString });
  const send = client.query.bind(client);
  let open = true;
  client.query = ((...args: Parameters<typeof send>) =>
    open
      ? send(...args)
      : Promise.reject(
          new Error("the test transaction is already rolled back"),
        )) as typeof send;
  const ready = client
    .connect()
    .then(() => send("begin"))
    .then(() => send("select pg_advisory_xact_lock(hashtext($1))", [lock]));
  return {
    client,
    ready,
    async rollback() {
      open = false;
      await ready.catch(() => {});
      await send("rollback").catch(() => {});
      await client.end();
    },
  };
}

/** Long enough to wait out another run of the same suite holding the lock. */
// ponytail: runs queue on one lock; raise this if many copies run at once.
export const SETUP_TIMEOUT = 120_000;
