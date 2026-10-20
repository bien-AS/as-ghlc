// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

import { inngest } from "@/lib/inngest/client";
import { fake, resetFakes, signIn, viewAs } from "@/test/server-fakes";

import { POST } from "./route";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);

const send = vi.spyOn(inngest, "send");
const post = (body: string) =>
  POST(
    new Request("http://localhost:3000/api/admin/ghl/import", {
      method: "POST",
      body,
    }),
  );

beforeEach(() => {
  resetFakes();
  send.mockReset().mockResolvedValue({ ids: ["event-1"] });
});

const admin = () => {
  signIn();
  fake.users.set("auth-user-1", {
    id: "auth-user-1",
    email: "ada@authoritysolutions.com",
    firstName: "Ada",
    lastName: "Lovelace",
  });
};

test("an admin starts the import: 202 and one event", async () => {
  admin();
  const response = await post("{}");
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ eventId: "event-1" });
  expect(send).toHaveBeenCalledWith({ name: "ghl/import.requested", data: {} });
});

test("a body other than {} is refused with 400 and nothing starts", async () => {
  admin();
  for (const body of ['{"all":true}', "not json", ""]) {
    expect((await post(body)).status).toBe(400);
  }
  expect(send).not.toHaveBeenCalled();
});

test("a rep is refused before the body is read: 403", async () => {
  viewAs("rep");
  const response = await post("not json");
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: { code: "forbidden" } });
  expect(send).not.toHaveBeenCalled();
});
