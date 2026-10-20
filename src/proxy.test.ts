// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

import { proxy } from "@/proxy";

const session = vi.hoisted(() => ({ sub: null as string | null }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({
        data: session.sub ? { claims: { sub: session.sub } } : null,
        error: null,
      }),
    },
  }),
}));

beforeEach(() => {
  session.sub = null;
});

const ORIGIN = "http://localhost:3000";
const visit = (path: string) => proxy(new NextRequest(`${ORIGIN}${path}`));

test("the root address has no page: it goes to the dashboard", async () => {
  const response = await visit("/");
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(`${ORIGIN}/dashboard`);
});

test("a signed-out visitor to an app screen goes to /login, remembering the page", async () => {
  const response = await visit("/leads/42?tab=notes");
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(
    `${ORIGIN}/login?next=%2Fleads%2F42%3Ftab%3Dnotes`,
  );
});

test("a signed-out visitor to /login or /access-denied is let through", async () => {
  for (const path of ["/login", "/access-denied?reason=deactivated"]) {
    const response = await visit(path);
    expect(response.headers.get("location"), path).toBeNull();
  }
});

test("a signed-in visitor is let through; the pages and guards decide the rest", async () => {
  session.sub = "auth-user-1";
  const response = await visit("/leads/42");
  expect(response.headers.get("location")).toBeNull();
});
