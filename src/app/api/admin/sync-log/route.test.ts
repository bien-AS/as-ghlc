// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

import { fake, resetFakes, signIn, viewAs } from "@/test/server-fakes";

import { POST } from "./[id]/retry/route";
import { GET } from "./route";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);

/*
 * The sync log routes refuse before touching the log: 401 signed out, 403 for a
 * rep, 400 for bad input. Reading and retrying the log itself is covered
 * against the database in src/lib/services/ghl/writes.db.test.ts.
 */

const ID = "00000000-0000-4000-8000-000000000001";
const list = (query = "") =>
  GET(new Request(`http://localhost:3000/api/admin/sync-log${query}`));
const retry = (id = ID, body = "{}") =>
  POST(
    new Request(`http://localhost:3000/api/admin/sync-log/${id}/retry`, {
      method: "POST",
      body,
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(resetFakes);

test("signed out: 401 on both", async () => {
  expect((await list()).status).toBe(401);
  expect((await retry()).status).toBe(401);
});

test("a rep: 403 on both, before the input is read", async () => {
  viewAs("rep");
  expect((await list("?result=nope")).status).toBe(403);
  const response = await retry("not-a-uuid", "not json");
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: { code: "forbidden" } });
});

test("an admin with bad input: 400 naming the field", async () => {
  signIn();
  fake.users.set("auth-user-1", {
    id: "auth-user-1",
    email: "ada@authoritysolutions.com",
    firstName: "Ada",
    lastName: "Lovelace",
  });
  const response = await list("?result=done&writeType=w1_verdict");
  expect(response.status).toBe(400);
  expect((await response.json()).error.fields).toHaveProperty("result");
  expect((await list("?cursor=abc")).status).toBe(400);
  expect((await list("?extra=1")).status).toBe(400);
  expect((await retry("not-a-uuid")).status).toBe(400);
  expect((await retry(ID, '{"force":true}')).status).toBe(400);
});
