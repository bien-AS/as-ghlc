// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

import { inngest } from "@/lib/inngest/client";
import {
  appointment,
  contactCreated,
} from "@/lib/inngest/functions/ghl-webhook.fixtures";

import { POST } from "./route";

/*
 * The route against an in-memory webhook_events (unique on provider + event_id,
 * as the table is); the real insert is covered by ghl-webhook.db.test.ts.
 */

type Row = {
  id: string;
  eventId: string;
  type: string;
  verified: boolean;
  payload: unknown;
  outcome?: string | null;
};
const table = vi.hoisted(() => new Map<string, Row>());
/** Set to make the next insert or delete fail, as an unreachable database would. */
const down = vi.hoisted(() => ({ record: false, forget: false }));
vi.mock("@/lib/inngest/functions/ghl-webhook", async (original) => ({
  ...(await original<typeof import("@/lib/inngest/functions/ghl-webhook")>()),
  recordWebhookEvent: async (event: Omit<Row, "id">) => {
    if (down.record) {
      down.record = false;
      throw new Error("db down");
    }
    if (table.has(event.eventId)) return null;
    const id = `row-${table.size + 1}`;
    table.set(event.eventId, { id, ...event });
    return id;
  },
  forgetWebhookEvent: async (id: string) => {
    if (down.forget) {
      down.forget = false;
      throw new Error("db down");
    }
    for (const [key, row] of table) if (row.id === id) table.delete(key);
  },
}));

const SECRET = "test-webhook-secret-7f3a";
const TOKEN = "test-ghl-token-91bd";
const send = vi.spyOn(inngest, "send");

const post = (
  body: unknown,
  {
    event = "contact_created",
    secret = SECRET as string | null,
    query = false,
  } = {},
) =>
  POST(
    new Request(
      `http://localhost:3000/api/webhooks/ghl?event=${event}${query && secret ? `&secret=${secret}` : ""}`,
      {
        method: "POST",
        headers: secret && !query ? { "x-webhook-secret": secret } : {},
        body: typeof body === "string" ? body : JSON.stringify(body),
      },
    ),
  );
const rows = () => [...table.values()];

beforeEach(() => {
  table.clear();
  vi.stubEnv("GHL_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("GHL_PRIVATE_TOKEN", TOKEN);
  send.mockReset().mockResolvedValue({ ids: ["event-1"] });
});

test("a verified event: 200, one row, one Inngest event", async () => {
  const response = await post(contactCreated());
  expect(response.status).toBe(200);
  expect(rows()).toEqual([
    expect.objectContaining({
      eventId: "wh-created-1",
      type: "contact_created",
      verified: true,
      payload: contactCreated(),
    }),
  ]);
  expect(send).toHaveBeenCalledExactlyOnceWith({
    name: "ghl/webhook.received",
    data: { webhookEventId: "row-1", contactId: "hook-test-contact-1" },
  });
});

test("the secret is also accepted in the URL", async () => {
  expect((await post(contactCreated(), { query: true })).status).toBe(200);
  expect(send).toHaveBeenCalledOnce();
});

test("the same webhookId twice: the second is 200 and changes nothing (check 5)", async () => {
  await post(appointment(1, "wh-dup"), { event: "appointment_booked" });
  const before = rows();
  const again = await post(appointment(1, "wh-dup"), {
    event: "appointment_booked",
  });
  expect(again.status).toBe(200);
  expect(await again.json()).toEqual({ received: true, duplicate: true });
  expect(rows()).toEqual(before);
  expect(send).toHaveBeenCalledOnce();
});

test("a missing or wrong secret: 401, recorded unverified, nothing sent (check 5)", async () => {
  for (const secret of [null, "wrong", `${SECRET}x`]) {
    expect((await post(contactCreated(), { secret })).status).toBe(401);
  }
  expect(rows()).toHaveLength(3);
  for (const row of rows()) {
    expect(row).toMatchObject({ verified: false, outcome: "refused" });
  }
  expect(send).not.toHaveBeenCalled();
});

test("an unverified request cannot claim a webhookId ahead of GHL", async () => {
  await post(contactCreated(), { secret: "wrong" });
  expect((await post(contactCreated())).status).toBe(200);
  expect(send).toHaveBeenCalledOnce();
});

test("with no secret configured, everything is refused", async () => {
  vi.stubEnv("GHL_WEBHOOK_SECRET", "");
  expect((await post(contactCreated(), { secret: "" })).status).toBe(401);
  expect(send).not.toHaveBeenCalled();
});

test("a malformed body or unknown event: 400, recorded, nothing sent", async () => {
  const cases = [
    post("not json"),
    post({ contact_id: "c-1" }), // no webhookId
    post(contactCreated(), { event: "appointment_booked" }), // no calendar
    post(contactCreated(), { event: "something_else" }),
  ];
  for (const response of await Promise.all(cases)) {
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_input");
  }
  expect(rows()).toHaveLength(4);
  for (const row of rows()) {
    expect(row).toMatchObject({ verified: true, outcome: "malformed" });
  }
  expect(send).not.toHaveBeenCalled();
});

test("Inngest unreachable: 429 so GHL retries, and the retry is not taken for a duplicate", async () => {
  send.mockRejectedValueOnce(new Error("down"));
  expect((await post(contactCreated())).status).toBe(429);
  expect(rows()).toHaveLength(0);
  expect((await post(contactCreated())).status).toBe(200);
  expect(send).toHaveBeenCalledTimes(2);
});

test("the database unreachable while recording: 429 so GHL retries, nothing sent", async () => {
  down.record = true;
  const response = await post(contactCreated());
  expect(response.status).toBe(429);
  expect((await response.json()).error.code).toBe("not_recorded");
  expect(send).not.toHaveBeenCalled();
  expect((await post(contactCreated())).status).toBe(200);
  expect(send).toHaveBeenCalledOnce();
});

test("Inngest and the database both unreachable: still 429, never a 5xx", async () => {
  send.mockRejectedValueOnce(new Error("down"));
  down.forget = true;
  expect((await post(contactCreated())).status).toBe(429);
});

// The token's half (a GHL error recorded by the job) is in ghl-webhook.test.ts.
test("neither the token nor the secret appears in any response or recorded row", async () => {
  const leaky = { ...contactCreated(), note: `pasted ${SECRET} here` };
  const responses = await Promise.all([
    post(leaky),
    post(leaky, { query: true }),
    post(leaky, { secret: "wrong" }),
    post(`${SECRET} not json`),
    post(leaky, { event: "nope" }),
  ]);
  const texts = await Promise.all(responses.map((r) => r.text()));
  for (const text of [...texts, JSON.stringify(rows())]) {
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(TOKEN.slice(5));
  }
});
