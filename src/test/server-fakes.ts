import { vi } from "vitest";

import type { CurrentUser } from "@/lib/auth/schemas";

/*
 * Stand-ins for the two server boundaries: Supabase Auth (stubbed at its
 * client) and the database. Test files wire them in with
 *   vi.mock("@/lib/supabase/server", async () => (await import("@/test/server-fakes")).supabaseServerModule);
 *   vi.mock("@/lib/prisma", async () => (await import("@/test/server-fakes")).prismaModule);
 */

type Claims = Record<string, unknown> | null;

export const fake = {
  claims: null as Claims,
  users: new Map<string, CurrentUser>(),
  /** The request's cookies, as `cookies()` from next/headers reads and writes them. */
  cookies: new Map<string, string>(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
};

export function resetFakes() {
  fake.claims = null;
  fake.users.clear();
  fake.cookies.clear();
  fake.verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  fake.exchangeCodeForSession
    .mockReset()
    .mockResolvedValue({ data: {}, error: null });
}

/** A verified session, as the token claims. `amr` says how it was established. */
export function signIn(claims: Record<string, unknown> = {}) {
  fake.claims = {
    sub: "auth-user-1",
    email: "ada@example.com",
    amr: [{ method: "password", timestamp: 1 }],
    user_metadata: {},
    ...claims,
  };
}

export const supabaseServerModule = {
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        fake.claims
          ? { data: { claims: fake.claims }, error: null }
          : { data: null, error: null },
      verifyOtp: fake.verifyOtp,
      exchangeCodeForSession: fake.exchangeCodeForSession,
    },
  }),
};

/** Wired in for every test by src/test/setup.ts. */
export const headersModule = {
  cookies: async () => ({
    get: (name: string) => {
      const value = fake.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      fake.cookies.set(name, value);
    },
    delete: (name: string) => {
      fake.cookies.delete(name);
    },
  }),
};

const uniqueViolation = () =>
  Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

export const prismaModule = {
  prisma: {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        fake.users.get(where.id) ?? null,
      create: async ({ data }: { data: CurrentUser }) => {
        const emailTaken = [...fake.users.values()].some(
          (user) => user.email === data.email,
        );
        if (fake.users.has(data.id) || emailTaken) throw uniqueViolation();
        fake.users.set(data.id, { ...data });
        return { ...data };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<CurrentUser>;
      }) => {
        const user = fake.users.get(where.id);
        if (!user) throw new Error("Record to update not found");
        const updated = { ...user, ...data };
        fake.users.set(where.id, updated);
        return { ...updated };
      },
    },
  },
};
